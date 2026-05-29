import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, optionalAuth, requireRole } from '../middleware/auth.js';
import notificationEvents from '../events.js';

const router = Router();

/**
 * GET /api/stats/public
 * Public marketplace stats (no auth required) — used in customer bento box.
 */
router.get('/public', async (req, res) => {
  try {
    const q = (sql) => pool.query(sql).then(r => r.rows[0]);

    const available = await q(`SELECT COUNT(*) as count FROM listings WHERE status = 'available'`);
    const categories = await q(`SELECT COUNT(DISTINCT category) as count FROM listings WHERE status = 'available' AND category IS NOT NULL`);
    const todayListed = await q(`SELECT COUNT(*) as count FROM listings WHERE date(listed_at) = date('now')`);
    const views = await q(`SELECT COALESCE(SUM(view_count), 0) as total FROM listings`);

    res.json({
      total_available: parseInt(available.count),
      total_categories: parseInt(categories.count),
      today_listed: parseInt(todayListed.count),
      total_views: parseInt(views.total),
    });
  } catch (err) {
    console.error('Public stats error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * GET /api/stats/customer
 * Authenticated customer stats — ticket counts for bento box.
 */
router.get('/customer', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const openTickets = await pool.query(
      `SELECT COUNT(*) as count FROM tickets WHERE customer_id = ? AND status IN ('open', 'in_progress')`,
      [userId]
    );
    const totalTickets = await pool.query(
      `SELECT COUNT(*) as count FROM tickets WHERE customer_id = ?`,
      [userId]
    );

    res.json({
      my_open_tickets: parseInt(openTickets.rows[0].count),
      my_total_tickets: parseInt(totalTickets.rows[0].count),
    });
  } catch (err) {
    console.error('Customer stats error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * GET /api/stats
 * Overview stats (inhaber+).
 */
router.get('/', requireAuth, requireRole('inhaber'), async (req, res) => {
  try {
    const r = (sql) => pool.query(sql).then(r => r.rows[0]);

    const active = await r(`SELECT COUNT(*) as count FROM listings WHERE status = 'available'`);
    const sold = await r(`SELECT COUNT(*) as count FROM listings WHERE status = 'sold'`);
    const ticketsOpen = await r(`SELECT COUNT(*) as count FROM tickets WHERE status IN ('open','in_progress')`);
    const views = await r(`SELECT COALESCE(SUM(view_count),0) as total FROM listings`);
    const users = await r(`SELECT COUNT(*) as count FROM users`);
    const avgPrice = await r(`SELECT COALESCE(AVG(sold_price),0) as avg FROM listings WHERE status = 'sold' AND sold_price > 0`);
    const monthListings = await r(`SELECT COUNT(*) as count FROM listings WHERE listed_at >= date('now','start of month')`);
    const monthRevenue = await r(`SELECT COALESCE(SUM(sold_price),0) as total FROM listings WHERE status = 'sold' AND sold_at >= date('now','start of month')`);

    // Recent activity
    const activityRes = await pool.query(
      `SELECT al.action, al.created_at, u.display_name as user_name
       FROM audit_log al LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT 15`
    );

    const ACTION_LABELS = {
      login:'Anmeldung', logout:'Abmeldung', dev_login:'Dev-Login',
      listing_created:'Inserat erstellt', listing_sold:'Fahrzeug verkauft',
      listing_deleted:'Inserat gelöscht', listing_updated:'Inserat bearbeitet',
      ticket_created:'Ticket erstellt', ticket_message:'Nachricht gesendet',
      ticket_status_changed:'Ticket-Status geändert',
      role_changed:'Rolle geändert', user_blocked:'Benutzer gesperrt',
      vault_payout:'Auszahlung', catalog_imported:'Katalog importiert',
    };

    res.json({
      listings_active: parseInt(active.count),
      listings_sold: parseInt(sold.count),
      tickets_open: parseInt(ticketsOpen.count),
      total_views: parseInt(views.total),
      total_users: parseInt(users.count),
      avg_price: Math.round(parseFloat(avgPrice.avg)),
      listings_month: parseInt(monthListings.count),
      revenue_month: parseInt(monthRevenue.total),
      recent_activity: activityRes.rows.map(a => ({
        ...a,
        action_label: `${a.user_name || 'System'}: ${ACTION_LABELS[a.action] || a.action}`,
      })),
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * GET /api/stats/notifications
 * Ultra-fast endpoint for polling unread/open tickets.
 */
router.get('/notifications', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = ['superadmin', 'stv_admin', 'inhaber'].includes(req.user.role);
    
    const result = await pool.query(
      isAdmin 
        ? `SELECT COUNT(*) as count FROM tickets WHERE status IN ('open','in_progress')`
        : `SELECT COUNT(*) as count FROM tickets WHERE (assigned_to = ? OR assigned_to IS NULL) AND status IN ('open','in_progress')`,
      isAdmin ? [] : [userId]
    );
    
    res.json({ open_tickets: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * GET /api/stats/notifications/stream
 * SSE endpoint for real-time notification updates.
 */
router.get('/notifications/stream', requireAuth, requireRole('mitarbeiter'), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onUpdate = () => {
    res.write('data: update\n\n');
  };

  notificationEvents.on('update', onUpdate);

  // Send initial ping to keep connection alive
  res.write('data: connected\n\n');

  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    notificationEvents.off('update', onUpdate);
    res.end();
  });
});

/**
 * GET /api/stats/dashboard
 * Personal dashboard stats for the current user (mitarbeiter+).
 */
router.get('/dashboard', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = ['superadmin', 'stv_admin', 'inhaber'].includes(req.user.role);

    const q = (sql, params = []) => pool.query(sql, params).then(r => r.rows[0]);

    const [listings, tickets, sales, views, vaultRes, topVehicles, activityRes] = await Promise.all([
      q(isAdmin
        ? `SELECT COUNT(*) as count FROM listings WHERE status = 'available'`
        : `SELECT COUNT(*) as count FROM listings WHERE status = 'available'`),
      q(isAdmin
        ? `SELECT COUNT(*) as count FROM tickets WHERE status IN ('open','in_progress')`
        : `SELECT COUNT(*) as count FROM tickets WHERE (assigned_to = ? OR assigned_to IS NULL) AND status IN ('open','in_progress')`,
        isAdmin ? [] : [userId]),
      q(`SELECT COUNT(*) as count FROM listings WHERE status = 'sold' AND sold_at >= date('now','start of month')`),
      q(`SELECT COALESCE(SUM(view_count),0) as total FROM listings`),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM vault_entries WHERE owner_id = ? AND status = 'pending'`,
        [userId]
      ),
      pool.query(
        `SELECT brand, model, 
                SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sales_count, 
                SUM(view_count) as views_count, 
                MAX(image_path) as image_path 
         FROM listings 
         GROUP BY brand, model 
         HAVING sales_count > 0 OR views_count > 0 
         ORDER BY sales_count DESC, views_count DESC 
         LIMIT 5`
      ),
      pool.query(
        `SELECT al.action, al.entity_type, al.details, al.created_at,
         u.display_name as user_name FROM audit_log al
         LEFT JOIN users u ON al.user_id = u.id
         ORDER BY al.created_at DESC LIMIT 10`
      )
    ]);

    const ACTION_LABELS = {
      login:'hat sich angemeldet', listing_created:'hat ein Inserat erstellt',
      listing_sold:'hat ein Fahrzeug verkauft', ticket_created:'hat ein Ticket erstellt',
      ticket_message:'hat eine Nachricht gesendet',
    };

    res.json({
      active_listings: parseInt(listings.count),
      open_tickets: parseInt(tickets.count),
      monthly_sales: parseInt(sales.count),
      monthly_views: parseInt(views.total),
      vault_balance: parseInt(vaultRes.rows[0].total),
      top_vehicles: topVehicles.rows,
      recent_activity: activityRes.rows.map(a => ({
        description: `${a.user_name||'System'} ${ACTION_LABELS[a.action]||a.action}`,
        time: new Date(a.created_at).toLocaleString('de-DE'),
        action: a.action,
      })),
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * GET /api/stats/leaderboard
 * Monthly ranking of staff (inhaber+).
 */
router.get('/leaderboard', requireAuth, requireRole('inhaber'), async (req, res) => {
  try {
    const period = req.query.period || 'current'; // current, last, all
    let dateFilter = '';
    
    if (period === 'current') dateFilter = "AND l.sold_at >= date('now', 'start of month')";
    else if (period === 'last') dateFilter = "AND l.sold_at >= date('now', 'start of month', '-1 month') AND l.sold_at < date('now', 'start of month')";

    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.role,
              COUNT(l.id) as sales_count,
              SUM(l.sold_price) as total_revenue,
              AVG(l.sold_price) as avg_price
       FROM users u
       JOIN listings l ON u.id = l.sold_by
       WHERE l.status = 'sold' ${dateFilter}
       GROUP BY u.id
       ORDER BY sales_count DESC, total_revenue DESC`
    );

    res.json(result.rows.map(r => ({
      ...r,
      sales_count: parseInt(r.sales_count),
      total_revenue: parseInt(r.total_revenue || 0),
      avg_price: Math.round(parseFloat(r.avg_price || 0))
    })));
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * GET /api/stats/activity-full
 * Full activity feed (inhaber+).
 */
router.get('/activity-full', requireAuth, requireRole('inhaber'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT al.*, u.display_name as user_name, u.avatar_url as user_avatar, u.role as user_role
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT 50`
    );

    const ACTION_LABELS = {
      login: 'hat sich angemeldet',
      logout: 'hat sich abgemeldet',
      listing_created: 'hat ein Inserat erstellt',
      listing_sold: 'hat ein Fahrzeug verkauft',
      listing_updated: 'hat ein Inserat bearbeitet',
      listing_deleted: 'hat ein Inserat gelöscht',
      ticket_created: 'hat eine Anfrage gestellt',
      ticket_message: 'hat eine Nachricht gesendet',
      ticket_status_changed: 'hat einen Ticket-Status geändert',
      vault_payout: 'hat eine Auszahlung bestätigt',
      review_posted: 'hat eine Bewertung abgegeben'
    };

    res.json(result.rows.map(a => ({
      ...a,
      label: ACTION_LABELS[a.action] || a.action,
      time: a.created_at
    })));
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

export default router;
