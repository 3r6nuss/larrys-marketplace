import { Router } from 'express';
import db from '../db.js';
import { logAction } from '../middleware/auth.js';

const router = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/api/auth/discord/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const ADMIN_ROLES = ['superadmin', 'stv_admin', 'inhaber'];
const toId = (value) => Number.parseInt(value, 10);

const hasAdminRole = (role) => ADMIN_ROLES.includes(role);

const getUserById = async (id) => {
  if (!id) return null;
  const result = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return result.rows[0] || null;
};

const getUserRoleById = async (id) => {
  if (!id) return null;
  const result = await db.query('SELECT role FROM users WHERE id = ?', [id]);
  return result.rows[0]?.role || null;
};

// Hilfsfunktion zur Überprüfung, ob der Benutzer ein berechtigter Admin (Superadmin, Stv. Admin, Inhaber) ist
const isAllowedAdmin = async (req) => {
  if (!req.session?.userId) return false;
  
  // Aktuelle Benutzerrolle prüfen
  const currentRole = await getUserRoleById(req.session.userId);
  if (!currentRole) return false;
  
  if (hasAdminRole(currentRole)) {
    return true;
  }
  
  // Wenn der Benutzer gerade impersoniert, prüfen wir die Original-Rolle
  if (req.session.originalUserId) {
    const origRole = await getUserRoleById(req.session.originalUserId);
    if (origRole && hasAdminRole(origRole)) {
      return true;
    }
  }
  
  return false;
};

/**
 * GET /api/auth/discord
 * Leitet den Benutzer zur Discord OAuth2 Autorisierungsseite weiter.
 */
router.get('/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Discord OAuth ist auf diesem Server nicht konfiguriert.' });
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
 * GET /api/auth/virtual-users
 * Listet alle verfügbaren virtuellen Accounts auf (Nur für Superadmin, Stv. Admin, Inhaber).
 */
router.get('/virtual-users', async (req, res) => {
  if (!(await isAllowedAdmin(req))) {
    return res.status(403).json({ error: 'Keine Berechtigung.' });
  }

  try {
    const result = await db.query(
      `SELECT id, username, display_name, role, last_login FROM users WHERE discord_id LIKE 'virtual_%' ORDER BY id DESC`
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error('Failed to list virtual users:', err);
    res.status(500).json({ error: 'Fehler beim Auflisten der virtuellen Accounts.' });
  }
});

/**
 * POST /api/auth/virtual-users
 * Erstellt einen neuen virtuellen Account (Nur für Superadmin, Stv. Admin, Inhaber).
 */
router.post('/virtual-users', async (req, res) => {
  if (!(await isAllowedAdmin(req))) {
    return res.status(403).json({ error: 'Keine Berechtigung.' });
  }

  const { username, display_name, role } = req.body;
  if (!username || !display_name || !role) {
    return res.status(400).json({ error: 'Fehlende Felder: username, display_name und role sind erforderlich.' });
  }

  const validRoles = ['kunde', 'mitarbeiter', 'inhaber', 'stv_admin', 'superadmin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Ungültige Rolle.' });
  }

  try {
    const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const discordId = `virtual_${sanitizedUsername}_${Date.now()}`;
    
    // Prüfen, ob der Benutzername bereits existiert
    const checkUser = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'Benutzername existiert bereits.' });
    }

    const insertResult = await db.query(
      `INSERT INTO users (discord_id, username, display_name, role, has_completed_profile) VALUES (?, ?, ?, ?, 1) RETURNING *`,
      [discordId, username, display_name, role]
    );

    const newUser = insertResult.rows[0];
    res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    console.error('Failed to create virtual user:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen des virtuellen Accounts.' });
  }
});

/**
 * DELETE /api/auth/virtual-users/:id
 * Löscht einen virtuellen Account (Nur für Superadmin, Stv. Admin, Inhaber).
 */
router.delete('/virtual-users/:id', async (req, res) => {
  if (!(await isAllowedAdmin(req))) {
    return res.status(403).json({ error: 'Keine Berechtigung.' });
  }

  const { id } = req.params;

  try {
    // Aktive Session darf sich nicht selbst löschen
    if (toId(id) === req.session.userId) {
      return res.status(400).json({ error: 'Der aktuell aktive Account kann nicht gelöscht werden.' });
    }

    // Sicherstellen, dass es ein virtueller User ist
    const checkUser = await db.query('SELECT discord_id FROM users WHERE id = ?', [id]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }

    if (!checkUser.rows[0].discord_id.startsWith('virtual_')) {
      return res.status(403).json({ error: 'Nur virtuelle Accounts können gelöscht werden.' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete virtual user:', err);
    res.status(500).json({ error: 'Fehler beim Löschen des virtuellen Accounts.' });
  }
});

/**
 * POST /api/auth/impersonate
 * Ermöglicht das Einloggen in einen virtuellen Account bzw. das Zurückwechseln.
 */
router.post('/impersonate', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  // Aktuellen Benutzer holen
  const currentUser = await getUserById(req.session.userId);
  if (!currentUser) {
    return res.status(401).json({ error: 'Benutzer nicht gefunden.' });
  }

  let realAdminId = null;

  // Prüfen, ob der aktuelle Benutzer ein Admin ist oder ursprünglich ein Admin war
  if (hasAdminRole(currentUser.role)) {
    realAdminId = currentUser.id;
  } else if (req.session.originalUserId) {
    const originalUser = await getUserById(req.session.originalUserId);
    if (originalUser && hasAdminRole(originalUser.role)) {
      realAdminId = req.session.originalUserId;
    }
  }

  if (!realAdminId) {
    return res.status(403).json({ error: 'Nur Superadmin, Stv. Admin und Inhaber dürfen Accounts wechseln.' });
  }

  const { targetUserId } = req.body;

  // Fall 1: Zurückwechseln zum echten Admin-Account
  if (!targetUserId || targetUserId === realAdminId) {
    req.session.userId = realAdminId;
    delete req.session.originalUserId;
    const adminUser = await getUserById(realAdminId);
    await logAction(realAdminId, 'switch_back_admin', 'user', realAdminId, {}, req.ip);
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error during switch back:', err);
        return res.status(500).json({ error: 'Fehler beim Speichern der Session.' });
      }
      res.json({ success: true, user: adminUser });
    });
    return;
  }

  // Fall 2: In einen virtuellen Account wechseln
  const targetUser = await getUserById(targetUserId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Zielbenutzer nicht gefunden.' });
  }

  // Verifizieren, dass der Ziel-Account virtuell ist
  if (!targetUser.discord_id || !targetUser.discord_id.startsWith('virtual_')) {
    return res.status(403).json({ error: 'Es kann nur in virtuelle Accounts gewechselt werden.' });
  }

  // Impersonierung durchführen
  req.session.originalUserId = realAdminId;
  req.session.userId = targetUser.id;

  await logAction(realAdminId, 'impersonate_user', 'user', targetUser.id, { target_role: targetUser.role }, req.ip);

  console.log(`👤 Impersonation gestartet: ${currentUser.display_name} -> ${targetUser.display_name} (${targetUser.role})`);
  
  req.session.save((err) => {
    if (err) {
      console.error('Session save error during impersonation:', err);
      return res.status(500).json({ error: 'Fehler beim Speichern der Session.' });
    }
    res.json({ success: true, user: targetUser });
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

  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
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

    // 4. Upsert user in database
    await db.query(
      `INSERT INTO users (discord_id, username, display_name, avatar_url, last_login)
       VALUES ($1, $2, NULL, $3, NOW())
       ON CONFLICT (discord_id) DO UPDATE SET
         username = EXCLUDED.username,
         avatar_url = EXCLUDED.avatar_url,
         last_login = NOW()`,
      [discordUser.id, discordUser.username, avatarUrl]
    );

    const userResult = await db.query('SELECT * FROM users WHERE discord_id = ?', [discordUser.id]);
    const user = userResult.rows[0];
    if (!user) {
      throw new Error('Discord-Benutzer konnte nach dem Login nicht geladen werden.');
    }

    // Hardcode Superadmin für deine Discord ID
    if (discordUser.id === '823276402320998450' && user.role !== 'superadmin') {
      await db.query(`UPDATE users SET role = 'superadmin' WHERE id = $1`, [user.id]);
      user.role = 'superadmin';
      console.log('👑 Superadmin privileges granted to hardcoded ID 823276402320998450');
    }

    // 5. Set session
    req.session.userId = user.id;

    // 6. Log the login
    await logAction(user.id, 'login', 'user', user.id, {
      discord_username: discordUser.username,
    }, req.ip);

    // 7. Save session explicitly to avoid race condition and redirect to frontend
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect(`${FRONTEND_URL}/auth/callback?error=session_save`);
      }
      res.redirect(`${FRONTEND_URL}/auth/callback`);
    });

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
      'SELECT id, discord_id, username, display_name, first_name, last_name, avatar_url, role, is_blocked, created_at, last_login, has_completed_profile, discord_notifications FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      req.session.destroy();
      return res.status(401).json({ user: null });
    }

    const userData = {
      ...result.rows[0],
      is_impersonating: !!req.session.originalUserId
    };

    res.json({ user: userData });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
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
