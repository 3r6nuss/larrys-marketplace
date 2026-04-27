import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole, logAction, checkRateLimit } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/tickets
 * Create a new ticket. Rate limited: 3 per 30 seconds.
 */
router.post('/', requireAuth, async (req, res) => {
  const { listing_id, message } = req.body;
  if (!listing_id) return res.status(400).json({ error: 'Inserat-ID erforderlich.' });

  // Rate limit check: 3 tickets per 30 seconds
  const limited = await checkRateLimit(req.user.id, 'ticket_create', 3, 30);
  if (limited) {
    return res.status(429).json({ error: 'Zu viele Anfragen. Bitte warte.', halt_stop: true });
  }

  try {
    // Check if ticket already exists for this user/listing combo
    const existing = await pool.query(
      "SELECT id FROM tickets WHERE listing_id = ? AND customer_id = ? AND status NOT IN ('completed','cancelled')",
      [listing_id, req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Du hast bereits eine offene Anfrage für dieses Fahrzeug.',
        existing_ticket_id: existing.rows[0].id,
      });
    }

    // Check listing exists
    const listing = await pool.query('SELECT * FROM listings WHERE id = ?', [listing_id]);
    if (listing.rows.length === 0) return res.status(404).json({ error: 'Inserat nicht gefunden.' });

    // Create ticket
    await pool.query(
      "INSERT INTO tickets (listing_id, customer_id, status) VALUES (?, ?, 'open')",
      [listing_id, req.user.id]
    );
    const ticket = await pool.query(
      'SELECT * FROM tickets WHERE listing_id = ? AND customer_id = ? ORDER BY created_at DESC LIMIT 1',
      [listing_id, req.user.id]
    );
    const newTicket = ticket.rows[0];

    // Save initial message if provided
    if (message?.trim()) {
      await pool.query(
        'INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES (?, ?, ?)',
        [newTicket.id, req.user.id, message.trim()]
      );
    }

    await logAction(req.user.id, 'ticket_created', 'ticket', newTicket.id, { listing_id }, req.ip);
    res.status(201).json(newTicket);
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Tickets.' });
  }
});

/**
 * GET /api/tickets
 * List tickets visible to current user.
 */
router.get('/', requireAuth, async (req, res) => {
  const { status } = req.query;
  const isStaff = ['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter'].includes(req.user.role);

  let where = isStaff ? '' : 'WHERE t.customer_id = ?';
  let params = isStaff ? [] : [req.user.id];

  if (status && status !== 'all') {
    where = where ? `${where} AND t.status = ?` : 'WHERE t.status = ?';
    params.push(status);
  }

  try {
    const sql = `
      SELECT t.*,
        l.brand, l.model, l.plate, l.image_path,
        c.display_name as customer_name,
        a.display_name as assigned_name
      FROM tickets t
      LEFT JOIN listings l ON t.listing_id = l.id
      LEFT JOIN users c ON t.customer_id = c.id
      LEFT JOIN users a ON t.assigned_to = a.id
      ${where}
      ORDER BY t.updated_at DESC
    `;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get tickets error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Tickets.' });
  }
});

/**
 * GET /api/tickets/:id
 * Get ticket detail with messages.
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const isStaff = ['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter'].includes(req.user.role);

    const ticketRes = await pool.query(
      `SELECT t.*,
        l.brand, l.model, l.plate, l.image_path, l.category, l.catalog_id,
        c.display_name as customer_name, c.avatar_url as customer_avatar,
        a.display_name as assigned_name
       FROM tickets t
       LEFT JOIN listings l ON t.listing_id = l.id
       LEFT JOIN users c ON t.customer_id = c.id
       LEFT JOIN users a ON t.assigned_to = a.id
       WHERE t.id = ?`,
      [req.params.id]
    );

    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket nicht gefunden.' });

    const ticket = ticketRes.rows[0];

    // Only customer or staff can view
    if (!isStaff && ticket.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }

    // Load messages with sender info
    const msgRes = await pool.query(
      `SELECT tm.*, u.display_name as sender_name, u.avatar_url as sender_avatar, u.role as sender_role
       FROM ticket_messages tm
       LEFT JOIN users u ON tm.sender_id = u.id
       WHERE tm.ticket_id = ?
       ORDER BY tm.created_at ASC`,
      [ticket.id]
    );

    // Load catalog pricing if staff
    let catalog = null;
    if (isStaff && ticket.catalog_id) {
      const catRes = await pool.query('SELECT * FROM vehicle_catalog WHERE id = ?', [ticket.catalog_id]);
      catalog = catRes.rows[0] || null;
    }

    res.json({ ...ticket, messages: msgRes.rows, catalog });
  } catch (err) {
    console.error('Get ticket detail error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * POST /api/tickets/:id/messages
 * Send a message in a ticket.
 */
router.post('/:id/messages', requireAuth, async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Nachricht darf nicht leer sein.' });

  try {
    const isStaff = ['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter'].includes(req.user.role);
    const ticket = await pool.query('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (ticket.rows.length === 0) return res.status(404).json({ error: 'Ticket nicht gefunden.' });

    const t = ticket.rows[0];
    if (!isStaff && t.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }
    if (['completed', 'cancelled'].includes(t.status)) {
      return res.status(400).json({ error: 'Ticket ist geschlossen.' });
    }

    await pool.query(
      'INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES (?, ?, ?)',
      [t.id, req.user.id, message.trim()]
    );
    await pool.query(
      "UPDATE tickets SET updated_at = datetime('now') WHERE id = ?",
      [t.id]
    );

    await logAction(req.user.id, 'ticket_message', 'ticket', t.id, {}, req.ip);
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Fehler beim Senden.' });
  }
});

/**
 * PUT /api/tickets/:id/status
 * Update ticket status (staff only).
 */
router.put('/:id/status', requireAuth, async (req, res) => {
  let { status } = req.body;
  const valid = ['open', 'in_progress', 'reserved', 'completed', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Ungültiger Status.' });

  try {
    const ticketRes = await pool.query('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden.' });
    const ticket = ticketRes.rows[0];

    const isCustomer = ticket.customer_id === req.user.id;
    const isAssigned = ticket.assigned_to === req.user.id;
    const isStaff = ['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter'].includes(req.user.role);
    const isManagement = ['superadmin', 'stv_admin', 'inhaber'].includes(req.user.role);

    let allowed = false;

    // Customers can only close (completed/cancelled) their own tickets
    if (isCustomer && ['completed', 'cancelled'].includes(status)) {
      allowed = true;
      // If customer closes without staff interaction (status still open), force cancelled
      if (ticket.status === 'open') {
        status = 'cancelled';
      }
    } 
    // Management can do anything
    else if (isManagement) {
      allowed = true;
    }
    // Assigned seller can do anything
    else if (isAssigned) {
      allowed = true;
    }
    // Any staff can "accept" an open ticket
    else if (isStaff && ticket.status === 'open' && status === 'in_progress') {
      allowed = true;
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Keine Berechtigung diesen Status zu setzen.' });
    }

    const closeTime = ['completed', 'cancelled'].includes(status) ? "datetime('now')" : 'NULL';
    
    // If a staff member accepts an open ticket, they become the assigned seller
    let assignedTo = ticket.assigned_to;
    if (ticket.status === 'open' && status === 'in_progress' && isStaff) {
       assignedTo = req.user.id;
    }

    await pool.query(
      `UPDATE tickets SET status = ?, updated_at = datetime('now'), closed_at = ${closeTime}, assigned_to = ? WHERE id = ?`,
      [status, assignedTo, req.params.id]
    );

    await logAction(req.user.id, 'ticket_status_changed', 'ticket', parseInt(req.params.id), {
      old_status: ticket.status, new_status: status,
    }, req.ip);
    res.json({ success: true, status }); // Return final status
  } catch (err) {
    console.error('Update ticket status error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

export default router;
