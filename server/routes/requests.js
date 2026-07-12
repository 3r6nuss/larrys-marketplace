import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole, logAction, checkRateLimit } from '../middleware/auth.js';
import notificationEvents from '../events.js';

const router = Router();
const STAFF_ROLES = new Set(['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter']);

function isStaffUser(user) {
  return STAFF_ROLES.has(user?.role);
}

async function getRequestById(id) {
  const result = await pool.query('SELECT * FROM vehicle_requests WHERE id = ?', [id]);
  return result.rows[0] || null;
}

function toCount(value) {
  return Number.parseInt(value, 10) || 0;
}

function toId(value) {
  return Number.parseInt(value, 10);
}

/**
 * POST /api/requests
 * Customer creates a vehicle request (wishlist item).
 */
router.post('/', requireAuth, async (req, res) => {
  const { brand, model, notes } = req.body;
  if (!brand?.trim() || !model?.trim()) {
    return res.status(400).json({ error: 'Marke und Modell erforderlich.' });
  }

  // Rate limit: 5 per 60 seconds
  const limited = await checkRateLimit(req.user.id, 'vehicle_request', 5, 60);
  if (limited) {
    return res.status(429).json({ error: 'Zu viele Anfragen. Bitte warte.' });
  }

  // Check for duplicate open requests from same user for same brand+model
  const existing = await pool.query(
    `SELECT id FROM vehicle_requests WHERE customer_id = ? AND LOWER(brand) = LOWER(?) AND LOWER(model) = LOWER(?) AND status = 'open'`,
    [req.user.id, brand.trim(), model.trim()]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Du hast bereits eine offene Anfrage für dieses Fahrzeug.' });
  }

  try {
    const created = await pool.query(
      `INSERT INTO vehicle_requests (customer_id, brand, model, notes) VALUES (?, ?, ?, ?) RETURNING *`,
      [req.user.id, brand.trim(), model.trim(), notes?.trim() || null]
    );

    await logAction(req.user.id, 'vehicle_request_created', 'vehicle_request', created.rows[0]?.id, { brand, model }, req.ip);
    notificationEvents.emit('update');

    res.status(201).json(created.rows[0]);
  } catch (err) {
    console.error('Create vehicle request error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen der Anfrage.' });
  }
});

/**
 * GET /api/requests
 * Customers see their own, staff sees all.
 */
router.get('/', requireAuth, async (req, res) => {
  const isStaff = isStaffUser(req.user);
  const { status } = req.query;

  let where = isStaff ? '' : 'WHERE vr.customer_id = ?';
  let params = isStaff ? [] : [req.user.id];

  if (status && status !== 'all') {
    where = where ? `${where} AND vr.status = ?` : 'WHERE vr.status = ?';
    params.push(status);
  }

  try {
    const result = await pool.query(
      `SELECT vr.*,
        c.display_name as customer_name, c.avatar_url as customer_avatar,
        h.display_name as handler_name,
        l.brand as listing_brand, l.model as listing_model, l.image_path as listing_image,
        (SELECT li.image_path FROM listing_images li WHERE li.listing_id = l.id AND li.is_cover = 1 LIMIT 1) as listing_cover
       FROM vehicle_requests vr
       LEFT JOIN users c ON vr.customer_id = c.id
       LEFT JOIN users h ON vr.handled_by = h.id
       LEFT JOIN listings l ON vr.matched_listing_id = l.id
       ${where}
       ORDER BY CASE vr.status WHEN 'open' THEN 0 WHEN 'found' THEN 1 ELSE 2 END, vr.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get vehicle requests error:', err);
    res.status(500).json({ error: 'Fehler beim Laden.' });
  }
});

/**
 * PUT /api/requests/:id/match
 * Staff matches a request with an existing listing.
 */
router.put('/:id/match', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  const { listing_id } = req.body;
  if (!listing_id) return res.status(400).json({ error: 'Listing-ID erforderlich.' });

  try {
    const request = await getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });
    if (request.status !== 'open') return res.status(400).json({ error: 'Anfrage ist nicht mehr offen.' });

    // Verify listing exists and is available
    const listing = await pool.query('SELECT * FROM listings WHERE id = ? AND status = ?', [listing_id, 'available']);
    if (!listing.rows[0]) return res.status(404).json({ error: 'Listing nicht gefunden oder nicht verfügbar.' });

    await pool.query(
      `UPDATE vehicle_requests SET status = 'found', matched_listing_id = ?, handled_by = ?, updated_at = datetime('now') WHERE id = ?`,
      [listing_id, req.user.id, req.params.id]
    );

    await logAction(req.user.id, 'vehicle_request_matched', 'vehicle_request', toId(req.params.id), { listing_id }, req.ip);
    notificationEvents.emit('update');

    res.json({ success: true });
  } catch (err) {
    console.error('Match request error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * PUT /api/requests/:id/cancel
 * Customer or staff cancels a request.
 */
router.put('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });

    const isOwner = request.customer_id === req.user.id;
    const isStaff = isStaffUser(req.user);
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Keine Berechtigung.' });

    if (request.status === 'cancelled') {
      return res.status(400).json({ error: 'Anfrage ist bereits storniert.' });
    }

    await pool.query(
      `UPDATE vehicle_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`,
      [req.params.id]
    );

    await logAction(req.user.id, 'vehicle_request_cancelled', 'vehicle_request', toId(req.params.id), {}, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error('Cancel request error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * GET /api/requests/:id/messages
 * Customer and staff can read the conversation for a wishlist request.
 */
router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });

    const isOwner = request.customer_id === req.user.id;
    if (!isOwner && !isStaffUser(req.user)) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }

    const result = await pool.query(
      `SELECT vrm.*, u.display_name as sender_name, u.avatar_url as sender_avatar, u.role as sender_role
       FROM vehicle_request_messages vrm
       LEFT JOIN users u ON vrm.sender_id = u.id
       WHERE vrm.request_id = ?
       ORDER BY vrm.created_at ASC, vrm.id ASC`,
      [request.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get vehicle request messages error:', err);
    res.status(500).json({ error: 'Nachrichten konnten nicht geladen werden.' });
  }
});

/**
 * POST /api/requests/:id/messages
 * Customer and staff can chat after a vehicle has been found.
 */
router.post('/:id/messages', requireAuth, async (req, res) => {
  const message = req.body.message?.trim();
  if (!message) return res.status(400).json({ error: 'Nachricht darf nicht leer sein.' });
  if (message.length > 2000) return res.status(400).json({ error: 'Nachricht ist zu lang.' });

  try {
    const request = await getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });

    const isOwner = request.customer_id === req.user.id;
    if (!isOwner && !isStaffUser(req.user)) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }
    if (request.status === 'cancelled') {
      return res.status(400).json({ error: 'Die Anfrage ist storniert und der Chat geschlossen.' });
    }

    const limited = await checkRateLimit(req.user.id, 'vehicle_request_message', 10, 30);
    if (limited) return res.status(429).json({ error: 'Zu viele Nachrichten. Bitte warte kurz.' });

    const created = await pool.query(
      `INSERT INTO vehicle_request_messages (request_id, sender_id, message) VALUES (?, ?, ?) RETURNING *`,
      [request.id, req.user.id, message]
    );
    await pool.query(`UPDATE vehicle_requests SET updated_at = datetime('now') WHERE id = ?`, [request.id]);
    await logAction(req.user.id, 'vehicle_request_message', 'vehicle_request', request.id, {}, req.ip);
    notificationEvents.emit('update');

    res.status(201).json(created.rows[0]);
  } catch (err) {
    console.error('Send vehicle request message error:', err);
    res.status(500).json({ error: 'Nachricht konnte nicht gesendet werden.' });
  }
});

/**
 * GET /api/requests/count
 * Quick count of open requests (for dashboard tiles).
 */
router.get('/count', requireAuth, async (req, res) => {
  try {
    const isStaff = isStaffUser(req.user);

    if (isStaff) {
      const result = await pool.query(`SELECT COUNT(*) as count FROM vehicle_requests WHERE status = 'open'`);
      res.json({ open_requests: toCount(result.rows[0].count) });
    } else {
      const open = await pool.query(
        `SELECT COUNT(*) as count FROM vehicle_requests WHERE customer_id = ? AND status = 'open'`,
        [req.user.id]
      );
      const found = await pool.query(
        `SELECT COUNT(*) as count FROM vehicle_requests WHERE customer_id = ? AND status = 'found'`,
        [req.user.id]
      );
      res.json({
        open_requests: toCount(open.rows[0].count),
        found_requests: toCount(found.rows[0].count),
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

export default router;
