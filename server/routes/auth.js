import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/verify
 * Verify if a token is valid. Used by the frontend on page load.
 */
router.post('/verify', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false });
  }

  try {
    const result = await pool.query(
      'SELECT id, label FROM auth_tokens WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.json({ valid: false });
    }

    res.json({ valid: true, label: result.rows[0].label });
  } catch (err) {
    console.error('Token verify error:', err);
    res.status(500).json({ valid: false, error: 'Server-Fehler' });
  }
});

/**
 * POST /api/auth/tokens
 * Generate a new access token. Requires existing auth.
 */
router.post('/tokens', requireAuth, async (req, res) => {
  const { label } = req.body;
  const token = uuidv4();

  try {
    const result = await pool.query(
      'INSERT INTO auth_tokens (token, label) VALUES ($1, $2) RETURNING id, token, label, created_at',
      [token, label || 'Neuer Token']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Token creation error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Tokens.' });
  }
});

/**
 * GET /api/auth/tokens
 * List all tokens (for admin panel). Requires auth.
 */
router.get('/tokens', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, token, label, created_at FROM auth_tokens ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Token list error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Tokens.' });
  }
});

/**
 * DELETE /api/auth/tokens/:id
 * Delete a token. Requires auth.
 */
router.delete('/tokens/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM auth_tokens WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Token delete error:', err);
    res.status(500).json({ error: 'Fehler beim Löschen des Tokens.' });
  }
});

export default router;
