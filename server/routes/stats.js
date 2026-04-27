import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

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
 * GET /api/stats/dashboard
 * Personal dashboard stats for the current user (mitarbeiter+).
 */
router.get('/dashboard', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = ['superadmin', 'stv_admin', 'inhaber'].includes(req.user.role);

    const q = (sql, params = []) => pool.query(sql, params).then(r => r.rows[0]);

    const listings = await q(isAdmin
      ? `SELECT COUNT(*) as count FROM listings WHERE status = 'available'`
      : `SELECT COUNT(*) as count FROM listings WHERE seller_id = ? AND status = 'available'`,
      isAdmin ? [] : [userId]);

    const tickets = await q(isAdmin
      ? `SELECT COUNT(*) as count FROM tickets WHERE status IN ('open','in_progress')`
      : `SELECT COUNT(*) as count FROM tickets WHERE assigned_to = ? AND status IN ('open','in_progress')`,
      isAdmin ? [] : [userId]);

    const sales = await q(isAdmin
      ? `SELECT COUNT(*) as count FROM listings WHERE status = 'sold' AND sold_at >= date('now','start of month')`
      : `SELECT COUNT(*) as count FROM listings WHERE sold_by = ? AND status = 'sold' AND sold_at >= date('now','start of month')`,
      isAdmin ? [] : [userId]);

    const views = await q(isAdmin
      ? `SELECT COALESCE(SUM(view_count),0) as total FROM listings`
      : `SELECT COALESCE(SUM(view_count),0) as total FROM listings WHERE seller_id = ?`,
      isAdmin ? [] : [userId]);

    const activityRes = await pool.query(
      `SELECT al.action, al.entity_type, al.details, al.created_at,
       u.display_name as user_name FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       ${isAdmin ? '' : 'WHERE al.user_id = ?'}
       ORDER BY al.created_at DESC LIMIT 10`,
      isAdmin ? [] : [userId]
    );

    const ACTION_LABELS = {
      login:'hat sich angemeldet', listing_created:'hat ein Inserat erstellt',
      listing_sold:'hat ein Fahrzeug verkauft', ticket_created:'hat ein Ticket erstellt',
      ticket_message:'hat eine Nachricht gesendet',
    };

    const vaultRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM vault_entries WHERE owner_id = ? AND status = 'pending'`,
      [userId]
    );

    const topVehicles = await pool.query(
      `SELECT brand, model, 
              SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sales_count, 
              SUM(view_count) as views_count, 
              MAX(image_path) as image_path 
       FROM listings 
       ${isAdmin ? '' : 'WHERE seller_id = ? '}
       GROUP BY brand, model 
       HAVING sales_count > 0 OR views_count > 0 
       ORDER BY sales_count DESC, views_count DESC 
       LIMIT 5`,
      isAdmin ? [] : [userId]
    );

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

export default router;
