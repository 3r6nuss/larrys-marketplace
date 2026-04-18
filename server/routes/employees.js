import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/employees
 * List all employees.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM employees ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Mitarbeiter.' });
  }
});

/**
 * POST /api/employees
 * Create a new employee.
 */
router.post('/', requireAuth, async (req, res) => {
  const { name, role, phone } = req.body;

  if (!name || !role) {
    return res.status(400).json({ error: 'Name und Rolle sind Pflichtfelder.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO employees (name, role, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, role, phone || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Mitarbeiters.' });
  }
});

/**
 * PUT /api/employees/:id
 * Update an employee.
 */
router.put('/:id', requireAuth, async (req, res) => {
  const { name, role, phone } = req.body;

  try {
    const fields = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); params.push(name); }
    if (role !== undefined) { fields.push(`role = $${idx++}`); params.push(role); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); params.push(phone); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren.' });
    }

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE employees SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mitarbeiter nicht gefunden.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update employee error:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Mitarbeiters.' });
  }
});

/**
 * DELETE /api/employees/:id
 * Delete an employee.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM employees WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mitarbeiter nicht gefunden.' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Delete employee error:', err);
    res.status(500).json({ error: 'Fehler beim Löschen des Mitarbeiters.' });
  }
});

/**
 * PUT /api/employees/:id/default
 * Set an employee as the default user.
 * Unsets all other defaults first.
 */
router.put('/:id/default', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Unset all defaults
    await client.query('UPDATE employees SET is_default = FALSE');

    // Set the new default
    const result = await client.query(
      'UPDATE employees SET is_default = TRUE WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Mitarbeiter nicht gefunden.' });
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Set default employee error:', err);
    res.status(500).json({ error: 'Fehler beim Setzen des Standard-Nutzers.' });
  } finally {
    client.release();
  }
});

export default router;
