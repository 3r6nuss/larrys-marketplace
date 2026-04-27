import db from '../db.js';

const ROLE_HIERARCHY = {
  superadmin: 5,
  stv_admin: 4,
  inhaber: 3,
  mitarbeiter: 2,
  kunde: 1,
};

/**
 * Middleware: Requires the user to be logged in via session.
 * Attaches req.user with the full user record.
 */
export async function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (result.rows.length === 0) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Benutzer nicht gefunden.' });
    }

    const user = result.rows[0];
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Account gesperrt.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Interner Server-Fehler.' });
  }
}

/**
 * Middleware: Optionally attaches req.user if logged in, but doesn't block.
 */
export async function optionalAuth(req, res, next) {
  if (!req.session?.userId) {
    req.user = null;
    return next();
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    req.user = result.rows[0] || null;
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Middleware factory: Requires a minimum role level.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Nicht angemeldet.' });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const minLevel = Math.min(...allowedRoles.map(r => ROLE_HIERARCHY[r] || 999));

    if (userLevel < minLevel) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }

    next();
  };
}

/**
 * Logs an action to the audit_log table.
 */
export async function logAction(userId, action, entityType, entityId, details = {}, ipAddress = null) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, JSON.stringify(details), ipAddress]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

/**
 * Checks rate limit: max N actions within T seconds.
 * Returns true if rate limit exceeded.
 */
export async function checkRateLimit(userId, action, maxCount, windowSeconds) {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM rate_limits
       WHERE user_id = ? AND action = ?
       AND created_at > datetime('now', '-' || ? || ' seconds')`,
      [userId, action, windowSeconds]
    );
    const count = parseInt(result.rows[0].count);

    if (count >= maxCount) {
      return true;
    }

    await db.query(
      'INSERT INTO rate_limits (user_id, action) VALUES (?, ?)',
      [userId, action]
    );

    return false;
  } catch (err) {
    console.error('Rate limit check error:', err);
    return false;
  }
}

export { ROLE_HIERARCHY };
