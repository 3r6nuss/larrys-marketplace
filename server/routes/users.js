import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole, logAction, ROLE_HIERARCHY } from '../middleware/auth.js';

const router = Router();

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

/** PUT /api/users/:id/role */
router.put('/:id/role', requireAuth, requireRole('stv_admin'), async (req, res) => {
  const { role } = req.body;
  const validRoles = ['kunde', 'mitarbeiter', 'inhaber', 'stv_admin', 'superadmin'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Ungültige Rolle.' });

  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Eigene Rolle nicht änderbar.' });

  const target = await pool.query('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!target.rows[0]) return res.status(404).json({ error: 'Nicht gefunden.' });

  const myLevel = ROLE_HIERARCHY[req.user.role] || 0;
  if ((ROLE_HIERARCHY[role] || 0) >= myLevel) return res.status(403).json({ error: 'Rolle zu hoch.' });
  if ((ROLE_HIERARCHY[target.rows[0].role] || 0) >= myLevel) return res.status(403).json({ error: 'Kann Benutzer dieser Stufe nicht ändern.' });

  try {
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, targetId]);
    await logAction(req.user.id, 'role_changed', 'user', targetId, { old_role: target.rows[0].role, new_role: role }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** PUT /api/users/:id/block */
router.put('/:id/block', requireAuth, requireRole('inhaber'), async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Selbst-Sperrung nicht möglich.' });

  const target = await pool.query('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!target.rows[0]) return res.status(404).json({ error: 'Nicht gefunden.' });
  if (target.rows[0].role === 'superadmin') return res.status(403).json({ error: 'Superadmin kann nicht gesperrt werden.' });
  if (target.rows[0].role === 'stv_admin' && req.user.role !== 'superadmin') return res.status(403).json({ error: 'Nur Superadmin kann Stv. Admin sperren.' });

  try {
    await pool.query(
      "UPDATE users SET is_blocked = 1, blocked_by = ?, blocked_at = datetime('now') WHERE id = ?",
      [req.user.id, targetId]
    );
    await logAction(req.user.id, 'user_blocked', 'user', targetId, { username: target.rows[0].username }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** PUT /api/users/:id/unblock */
router.put('/:id/unblock', requireAuth, requireRole('inhaber'), async (req, res) => {
  const targetId = parseInt(req.params.id);
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
  const targetId = parseInt(req.params.id);
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

export default router;
