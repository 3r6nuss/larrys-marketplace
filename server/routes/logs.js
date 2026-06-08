import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

/**
 * GET /api/logs
 * Paginated audit log (inhaber+).
 * Query: ?action=&search=&role_type=&limit=50&offset=0
 */
router.get('/', requireAuth, requireRole('inhaber'), async (req, res) => {
  const { action, search, role_type, limit = 50, offset = 0 } = req.query;
  const safeLimit = toInt(limit, 50);
  const safeOffset = toInt(offset, 0);

  let where = [];
  let params = [];

  if (hasText(action)) { where.push('al.action = ?'); params.push(action); }
  
  if (role_type === 'staff') {
    where.push("u.role IN ('mitarbeiter', 'inhaber', 'stv_admin', 'superadmin')");
  } else if (role_type === 'customer') {
    where.push("u.role = 'kunde'");
  }

  if (hasText(search)) {
    where.push('(u.display_name LIKE ? OR u.username LIKE ? OR al.action LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const sql = `
      SELECT al.*, u.display_name as user_name, u.avatar_url as user_avatar, u.role as user_role
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
      pool.query(sql, [...params, safeLimit, safeOffset]),
      pool.query(countSql, params),
    ]);

    res.json({
      logs: result.rows,
      total: toInt(countResult.rows[0]?.total, 0),
      limit: safeLimit,
      offset: safeOffset,
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
router.get('/actions', requireAuth, requireRole('inhaber'), async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT action FROM audit_log ORDER BY action ASC');
    res.json(result.rows.map(r => r.action));
  } catch (err) {
    console.error('Get log actions error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

export default router;
