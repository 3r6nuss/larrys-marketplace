import { Router } from 'express';
import db from '../db.js';
import { logAction } from '../middleware/auth.js';

const router = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/api/auth/discord/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Dev mode: no Discord credentials configured
const IS_DEV_MODE = !DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET;

/**
 * GET /api/auth/discord
 * Redirects user to Discord OAuth2 authorization page.
 * In dev mode: redirects to dev login instead.
 */
router.get('/discord', (req, res) => {
  if (IS_DEV_MODE) {
    // In dev mode, redirect to dev login endpoint instead
    return res.redirect('/api/auth/dev-login?role=superadmin');
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

/**
 * GET /api/auth/dev-login
 * Development-only login. Creates/uses a dev user and sets session.
 * Accepts ?role= parameter to test different roles.
 * Available roles: superadmin, stv_admin, inhaber, mitarbeiter, kunde
 */
router.get('/dev-login', async (req, res) => {
  if (!IS_DEV_MODE) {
    return res.status(403).json({ error: 'Dev-Login nur im Entwicklungsmodus verfügbar.' });
  }

  const role = req.query.role || 'superadmin';
  const validRoles = ['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter', 'kunde'];
  const selectedRole = validRoles.includes(role) ? role : 'superadmin';

  const ROLE_NAMES = {
    superadmin: 'Dev Superadmin',
    stv_admin: 'Dev Stv. Admin',
    inhaber: 'Dev Geschäftsinhaber',
    mitarbeiter: 'Dev Mitarbeiter',
    kunde: 'Dev Kunde',
  };

  try {
    const discordId = `dev_${selectedRole}`;
    const displayName = ROLE_NAMES[selectedRole];

    // Upsert dev user — SQLite-compatible approach
    await db.query(
      `INSERT OR IGNORE INTO users (discord_id, username, display_name, role) VALUES (?, ?, ?, ?)`,
      [discordId, `dev_${selectedRole}`, displayName, selectedRole]
    );
    await db.query(
      `UPDATE users SET display_name = ?, role = ?, last_login = datetime('now') WHERE discord_id = ?`,
      [displayName, selectedRole, discordId]
    );
    const result = await db.query(
      `SELECT * FROM users WHERE discord_id = ?`,
      [discordId]
    );

    const user = result.rows[0];
    req.session.userId = user.id;

    await logAction(user.id, 'dev_login', 'user', user.id, { role: selectedRole }, req.ip);

    console.log(`🔓 Dev login: ${displayName} (${selectedRole})`);
    res.redirect(`${FRONTEND_URL}/auth/callback`);
  } catch (err) {
    console.error('Dev login error:', err);
    res.redirect(`${FRONTEND_URL}/auth/callback?error=dev_login_failed`);
  }
});

/**
 * GET /api/auth/dev-users
 * Lists available dev login roles (dev mode only).
 */
router.get('/dev-users', (req, res) => {
  if (!IS_DEV_MODE) {
    return res.status(403).json({ error: 'Nur im Entwicklungsmodus.' });
  }

  res.json({
    dev_mode: true,
    roles: [
      { role: 'superadmin', label: 'Superadmin', url: '/api/auth/dev-login?role=superadmin' },
      { role: 'stv_admin', label: 'Stv. Admin', url: '/api/auth/dev-login?role=stv_admin' },
      { role: 'inhaber', label: 'Geschäftsinhaber', url: '/api/auth/dev-login?role=inhaber' },
      { role: 'mitarbeiter', label: 'Mitarbeiter', url: '/api/auth/dev-login?role=mitarbeiter' },
      { role: 'kunde', label: 'Kunde', url: '/api/auth/dev-login?role=kunde' },
    ],
  });
});

/**
 * GET /api/auth/discord/callback
 * Handles Discord OAuth2 callback — exchanges code for token, fetches user info,
 * creates/updates user in DB, sets session.
 */
router.get('/discord/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${FRONTEND_URL}/auth/callback?error=discord_denied`);
  }

  if (IS_DEV_MODE) {
    return res.redirect(`${FRONTEND_URL}/auth/callback?error=no_discord_config`);
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      console.error('Discord token exchange failed:', await tokenRes.text());
      return res.redirect(`${FRONTEND_URL}/auth/callback?error=token_exchange`);
    }

    const tokenData = await tokenRes.json();

    // 2. Fetch Discord user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      console.error('Discord user fetch failed:', await userRes.text());
      return res.redirect(`${FRONTEND_URL}/auth/callback?error=user_fetch`);
    }

    const discordUser = await userRes.json();

    // 3. Build avatar URL
    let avatarUrl = null;
    if (discordUser.avatar) {
      const ext = discordUser.avatar.startsWith('a_') ? 'gif' : 'png';
      avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${ext}?size=128`;
    }

    const displayName = discordUser.global_name || discordUser.username;

    // 4. Upsert user in database
    const result = await db.query(
      `INSERT INTO users (discord_id, username, display_name, avatar_url, last_login)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (discord_id) DO UPDATE SET
         username = EXCLUDED.username,
         display_name = EXCLUDED.display_name,
         avatar_url = EXCLUDED.avatar_url,
         last_login = NOW()
       RETURNING *`,
      [discordUser.id, discordUser.username, displayName, avatarUrl]
    );

    const user = result.rows[0];

    // 5. Set session
    req.session.userId = user.id;

    // 6. Log the login
    await logAction(user.id, 'login', 'user', user.id, {
      discord_username: discordUser.username,
    }, req.ip);

    // 7. Redirect to frontend
    res.redirect(`${FRONTEND_URL}/auth/callback`);

  } catch (err) {
    console.error('Discord OAuth error:', err);
    res.redirect(`${FRONTEND_URL}/auth/callback?error=server_error`);
  }
});

/**
 * GET /api/auth/me
 * Returns current user info from session.
 */
router.get('/me', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ user: null });
  }

  try {
    const result = await db.query(
      'SELECT id, discord_id, username, display_name, avatar_url, role, is_blocked, created_at, last_login FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      req.session.destroy();
      return res.status(401).json({ user: null });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Server-Fehler.' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  const userId = req.session?.userId;

  req.session.destroy(async (err) => {
    if (err) console.error('Logout error:', err);
    if (userId) {
      await logAction(userId, 'logout', 'user', userId, {}, req.ip);
    }
    res.clearCookie('larrys.sid');
    res.json({ success: true });
  });
});

export default router;
