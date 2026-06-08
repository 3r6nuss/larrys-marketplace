import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, logAction } from '../middleware/auth.js';

const router = Router();
const toCount = (value) => Number.parseInt(value, 10) || 0;
const toOneDecimal = (value) => Number.parseFloat(Number.parseFloat(value || 0).toFixed(1));

async function getCompletedTicket(listingId, customerId) {
  const result = await pool.query(
    `SELECT id, assigned_to FROM tickets
     WHERE listing_id = ? AND customer_id = ? AND status = 'completed' LIMIT 1`,
    [listingId, customerId]
  );
  return result.rows[0] || null;
}

async function hasExistingReview(listingId, customerId) {
  const result = await pool.query(
    `SELECT id FROM reviews WHERE listing_id = ? AND customer_id = ?`,
    [listingId, customerId]
  );
  return result.rows.length > 0;
}

/**
 * POST /api/reviews
 * Post a review for a listing/seller.
 * Only allowed if the customer has a completed ticket for this listing.
 */
router.post('/', requireAuth, async (req, res) => {
  const { listing_id, rating, comment } = req.body;
  const customer_id = req.user.id;

  if (!listing_id || !rating) {
    return res.status(400).json({ error: 'Listing ID und Bewertung erforderlich.' });
  }

  try {
    // 1. Check if user has a completed ticket for this listing
    const completedTicket = await getCompletedTicket(listing_id, customer_id);
    if (!completedTicket) {
      return res.status(403).json({ error: 'Du kannst nur Fahrzeuge bewerten, die du über ein Ticket gekauft hast.' });
    }

    const seller_id = completedTicket.assigned_to;

    // 2. Check if already reviewed
    const alreadyReviewed = await hasExistingReview(listing_id, customer_id);
    if (alreadyReviewed) {
      return res.status(400).json({ error: 'Du hast dieses Fahrzeug bereits bewertet.' });
    }

    // 3. Insert review
    await pool.query(
      `INSERT INTO reviews (listing_id, seller_id, customer_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [listing_id, seller_id, customer_id, rating, comment || null]
    );

    await logAction(customer_id, 'review_posted', 'listing', listing_id, { rating }, req.ip);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Review post error:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Bewertung.' });
  }
});

/**
 * GET /api/reviews/seller/:id
 * Get average rating and recent reviews for a seller.
 */
router.get('/seller/:id', async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as total_reviews
       FROM reviews WHERE seller_id = ?`,
      [req.params.id]
    );

    const recent = await pool.query(
      `SELECT r.*, u.display_name as customer_name, u.avatar_url as customer_avatar
       FROM reviews r
       LEFT JOIN users u ON r.customer_id = u.id
       WHERE r.seller_id = ?
       ORDER BY r.created_at DESC LIMIT 5`,
      [req.params.id]
    );

    res.json({
      average: toOneDecimal(stats.rows[0].avg_rating),
      count: toCount(stats.rows[0].total_reviews),
      recent: recent.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * GET /api/reviews/check/:listingId
 * Check if the current user can review this listing.
 */
router.get('/check/:listingId', requireAuth, async (req, res) => {
  try {
    const completedTicket = await getCompletedTicket(req.params.listingId, req.user.id);
    const alreadyReviewed = await hasExistingReview(req.params.listingId, req.user.id);

    res.json({
      can_review: Boolean(completedTicket) && !alreadyReviewed
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

export default router;
