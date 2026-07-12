import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole, logAction, checkRateLimit, ROLE_HIERARCHY } from '../middleware/auth.js';
import discordBot, { sendDM, createEmbed } from '../discord-bot.js';

const router = Router();
const VALID_ROLES = ['kunde', 'mitarbeiter', 'inhaber', 'stv_admin', 'superadmin'];

const toId = (value) => Number.parseInt(value, 10);
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}' -]*[\p{L}\p{M}]$/u;

const normalizeName = (value) => typeof value === 'string'
  ? value.trim().replace(/\s+/g, ' ')
  : '';

const isValidName = (value) => value.length >= 2 && value.length <= 50 && NAME_PATTERN.test(value);

const getUserById = async (id) => {
  const result = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return result.rows[0] || null;
};

/** GET /api/users */
router.get('/', requireAuth, requireRole('inhaber'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, discord_id, username, display_name, avatar_url, role, is_blocked, blocked_at, created_at, last_login FROM users ORDER BY created_at ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler.' });
  }
});
/** GET /api/users/staff */
router.get('/staff', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, display_name, avatar_url, role FROM users WHERE role IN ('mitarbeiter', 'inhaber', 'stv_admin', 'superadmin') ORDER BY display_name ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Mitarbeiter.' });
  }
});

/** PUT /api/users/me/profile-name */
router.put('/me/profile-name', requireAuth, async (req, res) => {
  const firstName = normalizeName(req.body.first_name);
  const lastName = normalizeName(req.body.last_name);

  if (!isValidName(firstName) || !isValidName(lastName)) {
    return res.status(400).json({
      error: 'Bitte gib einen gültigen Vor- und Nachnamen mit jeweils 2 bis 50 Zeichen ein.',
    });
  }

  const displayName = `${firstName} ${lastName}`;

  try {
    await pool.query(
      'UPDATE users SET display_name = ?, first_name = ?, last_name = ?, has_completed_profile = 1 WHERE id = ?',
      [displayName, firstName, lastName, req.user.id]
    );
    await logAction(req.user.id, 'profile_name_set', 'user', req.user.id, {}, req.ip);
    res.json({ success: true, display_name: displayName, has_completed_profile: 1 });
  } catch (err) {
    console.error('Profile name update error:', err);
    res.status(500).json({ error: 'Der Name konnte nicht gespeichert werden.' });
  }
});

/** POST /api/users/me/test-discord-dm */
router.post('/me/test-discord-dm', requireAuth, requireRole('inhaber'), async (req, res) => {
  const message = req.body.message?.trim();
  if (!message) return res.status(400).json({ error: 'Bitte gib eine Testnachricht ein.' });
  if (message.length > 1000) return res.status(400).json({ error: 'Die Nachricht darf maximal 1000 Zeichen lang sein.' });
  if (!req.user.discord_id || req.user.discord_id.startsWith('dev_') || req.user.discord_id.startsWith('virtual_')) {
    return res.status(400).json({ error: 'Dein Konto ist nicht mit einem echten Discord-Konto verknüpft.' });
  }
  if (!discordBot.isReady()) {
    return res.status(503).json({ error: 'Der Discord-Bot ist nicht verbunden. Prüfe Token und Server-Logs.' });
  }

  const limited = await checkRateLimit(req.user.id, 'discord_test_dm', 3, 60);
  if (limited) return res.status(429).json({ error: 'Maximal drei Testnachrichten pro Minute.' });

  const embed = createEmbed()
    .setTitle('Discord-Testnachricht')
    .setDescription(message)
    .addFields({ name: 'Gesendet von', value: req.user.display_name || req.user.username || 'Administrator' });

  const sent = await sendDM(req.user.discord_id, embed);
  if (!sent) {
    return res.status(502).json({ error: 'Discord hat die DM abgelehnt. Prüfe, ob Direktnachrichten für den Server erlaubt sind.' });
  }

  await logAction(req.user.id, 'discord_test_dm_sent', 'user', req.user.id, {}, req.ip);
  res.json({ success: true });
});

/** PUT /api/users/:id/role */
router.put('/:id/role', requireAuth, requireRole('stv_admin'), async (req, res) => {
  const { role } = req.body;
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Ungültige Rolle.' });

  const targetId = toId(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Eigene Rolle nicht änderbar.' });

  const targetUser = await getUserById(targetId);
  if (!targetUser) return res.status(404).json({ error: 'Nicht gefunden.' });

  const myLevel = ROLE_HIERARCHY[req.user.role] || 0;
  if ((ROLE_HIERARCHY[role] || 0) >= myLevel) return res.status(403).json({ error: 'Rolle zu hoch.' });
  if ((ROLE_HIERARCHY[targetUser.role] || 0) >= myLevel) return res.status(403).json({ error: 'Kann Benutzer dieser Stufe nicht ändern.' });

  try {
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, targetId]);
    await logAction(req.user.id, 'role_changed', 'user', targetId, { old_role: targetUser.role, new_role: role }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** PUT /api/users/:id/block */
router.put('/:id/block', requireAuth, requireRole('inhaber'), async (req, res) => {
  const targetId = toId(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Selbst-Sperrung nicht möglich.' });

  const targetUser = await getUserById(targetId);
  if (!targetUser) return res.status(404).json({ error: 'Nicht gefunden.' });
  if (targetUser.role === 'superadmin') return res.status(403).json({ error: 'Superadmin kann nicht gesperrt werden.' });
  if (targetUser.role === 'stv_admin' && req.user.role !== 'superadmin') return res.status(403).json({ error: 'Nur Superadmin kann Stv. Admin sperren.' });

  try {
    await pool.query(
      "UPDATE users SET is_blocked = 1, blocked_by = ?, blocked_at = datetime('now') WHERE id = ?",
      [req.user.id, targetId]
    );
    await logAction(req.user.id, 'user_blocked', 'user', targetId, { username: targetUser.username }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** PUT /api/users/:id/unblock */
router.put('/:id/unblock', requireAuth, requireRole('inhaber'), async (req, res) => {
  const targetId = toId(req.params.id);
  try {
    await pool.query('UPDATE users SET is_blocked = 0, blocked_by = NULL, blocked_at = NULL WHERE id = ?', [targetId]);
    await logAction(req.user.id, 'user_unblocked', 'user', targetId, {}, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** PUT /api/users/:id/settings/discord-dms */
router.put('/:id/settings/discord-dms', requireAuth, async (req, res) => {
  const targetId = toId(req.params.id);
  const { enabled } = req.body;

  if (targetId !== req.user.id) {
    return res.status(403).json({ error: 'Du kannst nur deine eigenen Einstellungen ändern.' });
  }

  try {
    await pool.query('UPDATE users SET discord_notifications = ? WHERE id = ?', [enabled ? 1 : 0, targetId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** POST /api/users/onboarding-complete */
router.post('/onboarding-complete', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE users SET has_completed_onboarding = 1 WHERE id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Onboarding complete error:', err);
    res.status(500).json({ error: 'Fehler beim Speichern des Onboarding-Status.' });
  }
});

/** POST /api/users/onboarding-reset */
router.post('/onboarding-reset', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE users SET has_completed_onboarding = 0 WHERE id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Onboarding reset error:', err);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen des Onboarding-Status.' });
  }
});

export default router;
