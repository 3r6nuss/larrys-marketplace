import pool from '../db.js';

/**
 * Middleware that validates Bearer token from Authorization header.
 * Token must exist in the auth_tokens table.
 * 
 * This is a pseudo-auth system — will be replaced by Discord OAuth later.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Kein Zugriffstoken angegeben.' });
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  try {
    const result = await pool.query(
      'SELECT id, label FROM auth_tokens WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Ungültiges Zugriffstoken.' });
    }

    // Attach token info to request for potential later use
    req.authToken = result.rows[0];
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Interner Server-Fehler bei Authentifizierung.' });
  }
}
