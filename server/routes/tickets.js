import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole, logAction, checkRateLimit } from '../middleware/auth.js';
import notificationEvents from '../events.js';
import { sendDM, createEmbed } from '../discord-bot.js';
import { hasDiscordNotificationsEnabled, toId, toInt, userHasRole } from '../lib/route-helpers.js';

const router = Router();
const STAFF_ROLES = new Set(['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter']);
const MANAGEMENT_ROLES = new Set(['superadmin', 'stv_admin', 'inhaber']);

function isStaffUser(user) {
  return userHasRole(user, STAFF_ROLES);
}

function isManagementUser(user) {
  return userHasRole(user, MANAGEMENT_ROLES);
}

async function getTicketById(id) {
  const result = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);
  return result.rows[0] || null;
}

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
    
    // Notify staff
    notificationEvents.emit('update');
    
    // Discord DM an alle Mitarbeiter
    try {
      const staffRes = await pool.query("SELECT discord_id, discord_notifications FROM users WHERE role IN ('mitarbeiter', 'inhaber', 'stv_admin', 'superadmin')");
      const embed = createEmbed()
        .setTitle('🎫 Neue Fahrzeug-Anfrage')
        .setDescription(`Eine neue Anfrage für Inserat #${listing_id} wurde erstellt.`)
        .addFields({ name: 'Kunde', value: req.user.display_name || req.user.username || 'Unbekannt', inline: true });
      for (const st of staffRes.rows) {
        if (st.discord_id && (st.discord_notifications == 1 || st.discord_notifications === true)) {
          sendDM(st.discord_id, embed);
        }
      }
    } catch (e) { console.error('Discord DM error', e); }
    
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
  const { status, assigned_to, show_closed } = req.query;
  const isStaff = isStaffUser(req.user);

  let where = isStaff ? '' : 'WHERE t.customer_id = ?';
  let params = isStaff ? [] : [req.user.id];

  if (isStaff && assigned_to && assigned_to !== 'all') {
    where = where ? `${where} AND (t.assigned_to = ? OR t.assigned_to IS NULL)` : 'WHERE (t.assigned_to = ? OR t.assigned_to IS NULL)';
    params.push(assigned_to);
  }

  if (status && status !== 'all') {
    where = where ? `${where} AND t.status = ?` : 'WHERE t.status = ?';
    params.push(status);
  } else if (!show_closed || show_closed === 'false') {
    where = where ? `${where} AND t.status NOT IN ('completed', 'cancelled')` : "WHERE t.status NOT IN ('completed', 'cancelled')";
  }

  try {
    const sql = `
      SELECT t.*,
        l.brand, l.model, l.plate, l.image_path,
        c.display_name as customer_name,
        a.display_name as assigned_name,
        CASE WHEN ${isStaff ? '1' : '0'} = 1 THEN (t.updated_at > t.last_read_staff) ELSE (t.updated_at > t.last_read_customer) END as is_unread
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
    const isStaff = isStaffUser(req.user);

    const ticketRes = await pool.query(
      `SELECT t.*,
        l.brand, l.model, l.plate, l.image_path, l.category, l.catalog_id,
        c.display_name as customer_name, c.avatar_url as customer_avatar, c.created_at as customer_created_at,
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

    // Update last_read timestamp
    if (isStaff) {
      await pool.query("UPDATE tickets SET last_read_staff = datetime('now') WHERE id = ?", [ticket.id]);
    } else {
      await pool.query("UPDATE tickets SET last_read_customer = datetime('now') WHERE id = ?", [ticket.id]);
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

    // Fetch customer ERP stats if staff
    let customer_stats = null;
    if (isStaff) {
      const statsRes = await pool.query(
        `SELECT 
           COUNT(*) as completed_purchases_count,
           COALESCE(SUM(l.sold_price), 0) as total_spent
         FROM tickets t
         JOIN listings l ON t.listing_id = l.id
         WHERE t.customer_id = ? AND t.status = 'completed'`,
        [ticket.customer_id]
      );
      customer_stats = statsRes.rows[0] || { completed_purchases_count: 0, total_spent: 0 };
    }

    res.json({ ...ticket, messages: msgRes.rows, catalog, customer_stats });
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
    const isStaff = isStaffUser(req.user);
    const t = await getTicketById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Ticket nicht gefunden.' });

    if (!isStaff && t.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }
    if (['completed', 'cancelled'].includes(t.status)) {
      return res.status(400).json({ error: 'Ticket ist geschlossen.' });
    }

    const newErpStatus = isStaff ? 'waiting_customer' : 'waiting_staff';
    await pool.query(
      'INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES (?, ?, ?)',
      [t.id, req.user.id, message.trim()]
    );
    await pool.query(
      "UPDATE tickets SET updated_at = datetime('now'), erp_status = ? WHERE id = ?",
      [newErpStatus, t.id]
    );

    await logAction(req.user.id, 'ticket_message', 'ticket', t.id, {}, req.ip);

    // Discord DM to counterpart
    try {
      const targetUserId = isStaff ? t.customer_id : (t.assigned_to || null);
      if (targetUserId) {
        const targetRes = await pool.query("SELECT discord_id, discord_notifications FROM users WHERE id = ?", [targetUserId]);
        if (targetRes.rows.length > 0 && hasDiscordNotificationsEnabled(targetRes.rows[0])) {
          const embed = createEmbed()
            .setTitle(`💬 Neue Nachricht in Ticket #${t.id}`)
            .setDescription(`**${req.user.display_name || req.user.username || 'Benutzer'}**: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`)
            .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/tickets?modal=tickets`);
          sendDM(targetRes.rows[0].discord_id, embed);
        }
      }
    } catch (e) { console.error('DM error', e); }

    notificationEvents.emit('update');
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
    const ticket = await getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Nicht gefunden.' });

    const isCustomer = ticket.customer_id === req.user.id;
    const isAssigned = ticket.assigned_to === req.user.id;
    const isStaff = isStaffUser(req.user);
    const isManagement = isManagementUser(req.user);

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

    await logAction(req.user.id, 'ticket_status_changed', 'ticket', toId(req.params.id), {
      old_status: ticket.status, new_status: status,
    }, req.ip);

    // Notify staff
    notificationEvents.emit('update');

    // Discord DM to customer
    try {
      if (ticket.customer_id) {
        const custRes = await pool.query("SELECT discord_id, discord_notifications FROM users WHERE id = ?", [ticket.customer_id]);
        if (custRes.rows.length > 0 && hasDiscordNotificationsEnabled(custRes.rows[0])) {
          const embed = createEmbed()
            .setTitle(`📋 Ticket Status Update`)
            .setDescription(`Dein Ticket #${req.params.id} ist nun: **${status}**`);
          sendDM(custRes.rows[0].discord_id, embed);
        }
      }
    } catch (e) { console.error('DM error', e); }

    res.json({ success: true, status }); // Return final status
  } catch (err) {
    console.error('Update ticket status error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * PUT /api/tickets/:id/erp-status
 * Update ticket ERP status manually.
 */
router.put('/:id/erp-status', requireAuth, async (req, res) => {
  const { erp_status } = req.body;
  const valid = ['open', 'waiting_staff', 'waiting_customer', 'completed'];
  if (!valid.includes(erp_status)) return res.status(400).json({ error: 'Ungültiger ERP-Status.' });

  try {
    const isStaff = isStaffUser(req.user);
    const ticket = await getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden.' });

    const isCustomer = ticket.customer_id === req.user.id;
    if (!isStaff && !isCustomer) return res.status(403).json({ error: 'Keine Berechtigung.' });
    if (!isStaff && erp_status !== 'completed') {
      return res.status(403).json({ error: 'Kunde kann Ticket nur abschließen.' });
    }

    await pool.query(
      "UPDATE tickets SET erp_status = ?, updated_at = datetime('now') WHERE id = ?",
      [erp_status, req.params.id]
    );

    if (erp_status === 'completed') {
      await pool.query(
        "UPDATE tickets SET status = 'completed', closed_at = datetime('now') WHERE id = ?",
        [req.params.id]
      );
    }

    await logAction(req.user.id, 'ticket_erp_status_changed', 'ticket', toId(req.params.id), {
      old_status: ticket.erp_status, new_status: erp_status,
    }, req.ip);

    notificationEvents.emit('update');
    res.json({ success: true, erp_status });
  } catch (err) {
    console.error('Update ERP status error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * POST /api/tickets/:id/contract
 * Create purchase contract in ticket (staff only).
 */
router.post('/:id/contract', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  const { price, payment_type } = req.body;
  if (!price || !payment_type) return res.status(400).json({ error: 'Preis und Zahlungsart erforderlich.' });

  try {
    const ticket = await getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden.' });

    if (['completed', 'cancelled'].includes(ticket.status)) {
      return res.status(400).json({ error: 'Ticket ist bereits geschlossen.' });
    }

    await pool.query(
      `UPDATE tickets SET 
         contract_price = ?, 
         contract_payment_type = ?, 
         contract_created_at = datetime('now'),
         updated_at = datetime('now')
       WHERE id = ?`,
      [toInt(price), payment_type, req.params.id]
    );

    const systemMsg = `[SYSTEM_CONTRACT_CREATED] ${price} | ${payment_type}`;
    await pool.query(
      'INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, systemMsg]
    );

    await logAction(req.user.id, 'ticket_contract_created', 'ticket', toId(req.params.id), {
      price, payment_type,
    }, req.ip);

    notificationEvents.emit('update');
    res.json({ success: true });
  } catch (err) {
    console.error('Create contract error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Kaufvertrags.' });
  }
});

/**
 * DELETE /api/tickets/:id/contract
 * Cancel contract in ticket (staff only).
 */
router.delete('/:id/contract', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const ticket = await getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden.' });

    if (['completed', 'cancelled'].includes(ticket.status)) {
      return res.status(400).json({ error: 'Ticket ist bereits geschlossen.' });
    }

    await pool.query(
      `UPDATE tickets SET 
         contract_price = 0, 
         contract_payment_type = NULL, 
         contract_created_at = NULL,
         updated_at = datetime('now')
       WHERE id = ?`,
      [req.params.id]
    );

    const systemMsg = `[SYSTEM_CONTRACT_CANCELLED]`;
    await pool.query(
      'INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, systemMsg]
    );

    await logAction(req.user.id, 'ticket_contract_cancelled', 'ticket', toId(req.params.id), {}, req.ip);

    notificationEvents.emit('update');
    res.json({ success: true });
  } catch (err) {
    console.error('Cancel contract error:', err);
    res.status(500).json({ error: 'Fehler beim Stornieren des Kaufvertrags.' });
  }
});

/**
 * POST /api/tickets/:id/finalize
 * Finalize sale and hand over vehicle (staff only).
 */
router.post('/:id/finalize', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const ticketRes = await pool.query(
      `SELECT t.*, l.id as listing_id, l.seller_id, l.brand, l.model, l.plate,
              c.display_name as customer_name
       FROM tickets t
       LEFT JOIN listings l ON t.listing_id = l.id
       LEFT JOIN users c ON t.customer_id = c.id
       WHERE t.id = ?`,
      [req.params.id]
    );

    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket nicht gefunden.' });
    const ticket = ticketRes.rows[0];

    if (['completed', 'cancelled'].includes(ticket.status)) {
      return res.status(400).json({ error: 'Ticket ist bereits geschlossen.' });
    }

    if (!ticket.contract_price || ticket.contract_price <= 0) {
      return res.status(400).json({ error: 'Es wurde noch kein Kaufvertrag erstellt.' });
    }

    // 1. Mark listing as sold
    await pool.query(
      "UPDATE listings SET status = 'sold', sold_at = datetime('now'), sold_by = ?, sold_to_name = ?, sold_price = ? WHERE id = ?",
      [req.user.id, ticket.customer_name || 'Kunde', ticket.contract_price, ticket.listing_id]
    );

    // 2. Create vault entry if sold on behalf of another employee
    if (ticket.seller_id !== req.user.id) {
      await pool.query(
        "INSERT INTO vault_entries (listing_id, owner_id, sold_by_id, amount, status, note) VALUES (?, ?, ?, ?, 'pending', ?)",
        [ticket.listing_id, ticket.seller_id, req.user.id, ticket.contract_price, `Verkauf über Ticket #${ticket.id}`]
      );
    }

    // 3. Mark ticket and ERP status as completed
    await pool.query(
      "UPDATE tickets SET status = 'completed', erp_status = 'completed', closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      [ticket.id]
    );

    // 4. Insert formal system message in chat
    const systemMsg = `[SYSTEM_CONTRACT_FINALIZED]`;
    await pool.query(
      'INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES (?, ?, ?)',
      [ticket.id, req.user.id, systemMsg]
    );

    await logAction(req.user.id, 'ticket_finalized', 'ticket', ticket.id, {
      listing_id: ticket.listing_id,
      sold_price: ticket.contract_price,
      sold_to: ticket.customer_name,
    }, req.ip);

    notificationEvents.emit('update');
    res.json({ success: true });
  } catch (err) {
    console.error('Finalize ticket error:', err);
    res.status(500).json({ error: 'Fehler beim Abschließen des Verkaufs.' });
  }
});

export default router;
