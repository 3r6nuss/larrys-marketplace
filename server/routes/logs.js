import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/logs
 * Paginated audit log (stv_admin+).
 * Query: ?action=&search=&limit=50&offset=0
 */
router.get('/', requireAuth, requireRole('stv_admin'), async (req, res) => {
  const { action, search, limit = 50, offset = 0 } = req.query;

  let where = [];
  let params = [];

  if (action) { where.push('al.action = ?'); params.push(action); }
  if (search) {
    where.push('(u.display_name LIKE ? OR u.username LIKE ? OR al.action LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const sql = `
      SELECT al.*, u.display_name as user_name, u.avatar_url as user_avatar
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const countSql = `
      SELECT COUNT(*) as total FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
    `;

    const [result, countResult] = await Promise.all([
      pool.query(sql, [...params, parseInt(limit), parseInt(offset)]),
      pool.query(countSql, params),
    ]);

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0]?.total || 0),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Logs.' });
  }
});

/**
 * GET /api/logs/actions
 * Get distinct action types for filter dropdown.
 */
router.get('/actions', requireAuth, requireRole('stv_admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT action FROM audit_log ORDER BY action ASC');
    res.json(result.rows.map(r => r.action));
  } catch (err) {
    console.error('Get log actions error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

export default router;
