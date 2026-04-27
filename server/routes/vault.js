import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole, logAction } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/vault
 * List vault entries visible to the current user.
 */
router.get('/', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const isAdmin = ['superadmin', 'stv_admin', 'inhaber'].includes(req.user.role);
    const sql = `
      SELECT ve.*,
        l.brand, l.model, l.plate,
        o.display_name as owner_name, o.avatar_url as owner_avatar,
        s.display_name as sold_by_name
      FROM vault_entries ve
      LEFT JOIN listings l ON ve.listing_id = l.id
      LEFT JOIN users o ON ve.owner_id = o.id
      LEFT JOIN users s ON ve.sold_by_id = s.id
      ${isAdmin ? '' : 'WHERE (ve.owner_id = ? OR ve.sold_by_id = ?)'}
      ORDER BY ve.created_at DESC
    `;
    const params = isAdmin ? [] : [req.user.id, req.user.id];
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get vault error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Tresor-Einträge.' });
  }
});

/**
 * PUT /api/vault/:id/payout
 * Mark vault entry as paid out (inhaber+).
 */
router.put('/:id/payout', requireAuth, requireRole('inhaber'), async (req, res) => {
  try {
    const entry = await pool.query('SELECT * FROM vault_entries WHERE id = ?', [req.params.id]);
    if (entry.rows.length === 0) return res.status(404).json({ error: 'Eintrag nicht gefunden.' });
    if (entry.rows[0].status === 'paid_out') return res.status(400).json({ error: 'Bereits ausgezahlt.' });

    await pool.query(
      "UPDATE vault_entries SET status = 'paid_out', paid_out_at = datetime('now'), confirmed_by = ? WHERE id = ?",
      [req.user.id, req.params.id]
    );

    await logAction(req.user.id, 'vault_payout', 'vault', parseInt(req.params.id), {}, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error('Vault payout error:', err);
    res.status(500).json({ error: 'Fehler bei der Auszahlung.' });
  }
});

/**
 * PUT /api/vault/:id/revert
 * Revert a payout back to pending (superadmin only).
 */
router.put('/:id/revert', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    await pool.query(
      "UPDATE vault_entries SET status = 'pending', paid_out_at = NULL, confirmed_by = NULL WHERE id = ?",
      [req.params.id]
    );
    await logAction(req.user.id, 'vault_payout_reverted', 'vault', parseInt(req.params.id), {}, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error('Vault revert error:', err);
    res.status(500).json({ error: 'Fehler beim Rückgängig machen.' });
  }
});

export default router;
