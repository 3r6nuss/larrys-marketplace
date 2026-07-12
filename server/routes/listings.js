import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { requireAuth, optionalAuth, requireRole, logAction } from '../middleware/auth.js';
import { canManageOwnedResource, toCount, toId, toInt, userHasRole } from '../lib/route-helpers.js';

const router = Router();
const ADMIN_ROLES = new Set(['superadmin', 'stv_admin', 'inhaber']);
const STAFF_ROLES = new Set(['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter']);

const isStaffUser = (user) => userHasRole(user, STAFF_ROLES);

const getListingById = async (listingId) => {
  const result = await pool.query('SELECT * FROM listings WHERE id = ?', [listingId]);
  return result.rows[0] || null;
};

const canManageListing = (listing, user) => {
  if (!listing || !user) return false;
  return canManageOwnedResource(listing.seller_id, user, ADMIN_ROLES);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
  filename: (req, file, cb) => { const ext = path.extname(file.originalname) || '.png'; cb(null, `listing-${uuidv4()}${ext}`); },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { if (file.mimetype.startsWith('image/')) cb(null, true); else cb(new Error('Nur Bilddateien.')); } });

async function saveBase64Image(b64) {
  const matches = b64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return null;
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const filename = `listing-${uuidv4()}.${ext}`;
  const { writeFile } = await import('fs/promises');
  await writeFile(path.join(process.cwd(), 'uploads', filename), Buffer.from(matches[2], 'base64'));
  return `/uploads/${filename}`;
}

/** GET /api/listings/recent?ids=1,2,3 — Public: lightweight recently viewed cards */
router.get('/recent', async (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map(value => Number.parseInt(value, 10))
    .filter((value, index, values) => Number.isInteger(value) && value > 0 && values.indexOf(value) === index)
    .slice(0, 5);

  if (ids.length === 0) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT l.id, l.brand, l.model, l.category, l.image_path,
              (SELECT li.image_path FROM listing_images li WHERE li.listing_id = l.id AND li.is_cover = 1 LIMIT 1) as cover_image
       FROM listings l
       WHERE l.id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    const listingsById = new Map(result.rows.map(listing => [Number(listing.id), listing]));
    res.json(ids.map(id => listingsById.get(id)).filter(Boolean));
  } catch (err) {
    console.error('Recent listings error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** GET /api/listings/featured — Public: returns featured listings */
router.get('/featured', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.id, l.brand, l.model, l.plate, l.category, l.image_path, l.status, l.discount_pct,
              u.display_name as seller_name, u.avatar_url as seller_avatar,
              (SELECT li.image_path FROM listing_images li WHERE li.listing_id = l.id AND li.is_cover = 1 LIMIT 1) as cover_image
       FROM listings l LEFT JOIN users u ON l.seller_id = u.id
       WHERE l.is_featured = 1 AND l.status = 'available'
       ORDER BY RANDOM() LIMIT 6`
    );
    res.json(result.rows.map(r => ({ ...r, cover_image: r.cover_image || r.image_path })));
  } catch (err) {
    console.error('Featured listings error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** GET /api/listings/newest — Public: returns newest listings */
router.get('/newest', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.id, l.brand, l.model, l.plate, l.category, l.image_path, l.status, l.discount_pct,
              u.display_name as seller_name, u.avatar_url as seller_avatar,
              (SELECT li.image_path FROM listing_images li WHERE li.listing_id = l.id AND li.is_cover = 1 LIMIT 1) as cover_image
       FROM listings l LEFT JOIN users u ON l.seller_id = u.id
       WHERE l.status = 'available'
       ORDER BY l.listed_at DESC LIMIT 6`
    );
    res.json(result.rows.map(r => ({ ...r, cover_image: r.cover_image || r.image_path })));
  } catch (err) {
    console.error('Newest listings error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** GET /api/listings/filters — Public catalog filter metadata */
router.get('/filters', async (req, res) => {
  try {
    const [categoryResult, priceResult] = await Promise.all([
      pool.query(`SELECT DISTINCT category FROM listings WHERE status = 'available' AND category IS NOT NULL AND category != '' ORDER BY category ASC`),
      pool.query(`SELECT MIN(custom_price) as min_price, MAX(custom_price) as max_price FROM listings WHERE status = 'available' AND custom_price IS NOT NULL`),
    ]);
    res.json({
      categories: categoryResult.rows.map(row => row.category),
      min_price: Number.parseInt(priceResult.rows[0]?.min_price, 10) || 0,
      max_price: Number.parseInt(priceResult.rows[0]?.max_price, 10) || 0,
    });
  } catch (err) {
    console.error('Listing filters error:', err);
    res.status(500).json({ error: 'Filter konnten nicht geladen werden.' });
  }
});

/** GET /api/listings */
router.get('/', optionalAuth, async (req, res) => {
  const { category, q, seller_id, status = 'available', sort = 'newest', min_price, max_price } = req.query;
  let where = [];
  let params = [];

  const minPrice = Number.parseInt(min_price, 10);
  const maxPrice = Number.parseInt(max_price, 10);
  const orderBy = {
    newest: 'l.listed_at DESC',
    oldest: 'l.listed_at ASC',
    name_asc: 'l.brand ASC, l.model ASC',
    name_desc: 'l.brand DESC, l.model DESC',
    price_asc: 'CASE WHEN l.custom_price IS NULL THEN 1 ELSE 0 END, l.custom_price ASC',
    price_desc: 'CASE WHEN l.custom_price IS NULL THEN 1 ELSE 0 END, l.custom_price DESC',
  }[sort] || 'l.listed_at DESC';

  if (category && category !== 'all') { where.push('l.category = ?'); params.push(category); }
  if (status && status !== 'all') { where.push('l.status = ?'); params.push(status); }
  if (seller_id) { where.push('l.seller_id = ?'); params.push(seller_id); }
  if (q) { where.push('(l.brand LIKE ? OR l.model LIKE ? OR l.plate LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (Number.isFinite(minPrice) && minPrice >= 0) { where.push('l.custom_price >= ?'); params.push(minPrice); }
  if (Number.isFinite(maxPrice) && maxPrice >= 0) { where.push('l.custom_price <= ?'); params.push(maxPrice); }

  const sql = `SELECT l.*, u.display_name as seller_name, u.avatar_url as seller_avatar
               FROM listings l LEFT JOIN users u ON l.seller_id = u.id
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY ${orderBy}`;
  try {
    const result = await pool.query(sql, params);
    const isMitarbeiter = isStaffUser(req.user);

    // Fetch image counts and cover images for all listings
    const listingIds = result.rows.map(r => r.id);
    let imageMap = {};
    if (listingIds.length > 0) {
      const imgResult = await pool.query(
        `SELECT listing_id, image_path, is_cover FROM listing_images WHERE listing_id IN (${listingIds.map(() => '?').join(',')}) ORDER BY sort_order ASC`,
        listingIds
      );
      for (const img of imgResult.rows) {
        if (!imageMap[img.listing_id]) imageMap[img.listing_id] = { cover: null, count: 0 };
        imageMap[img.listing_id].count++;
        if (img.is_cover) imageMap[img.listing_id].cover = img.image_path;
        if (!imageMap[img.listing_id].cover) imageMap[img.listing_id].cover = img.image_path;
      }
    }

    res.json(result.rows.map(l => {
      const imgs = imageMap[l.id];
      const enriched = {
        ...l,
        cover_image: imgs?.cover || l.image_path || null,
        image_count: imgs?.count || (l.image_path ? 1 : 0),
      };
      if (!isMitarbeiter) { const { custom_price, notes, sold_price, ...safe } = enriched; return safe; }
      return enriched;
    }));
  } catch (err) {
    console.error('Get listings error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** GET /api/listings/:id */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT l.*, u.display_name as seller_name, u.avatar_url as seller_avatar, u.role as seller_role FROM listings l LEFT JOIN users u ON l.seller_id = u.id WHERE l.id = ?',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Nicht gefunden.' });

    await pool.query('UPDATE listings SET view_count = view_count + 1 WHERE id = ?', [req.params.id]);

    const listing = result.rows[0];
    const isMitarbeiter = isStaffUser(req.user);

    // Fetch all images
    const imagesResult = await pool.query(
      'SELECT id, image_path, sort_order, is_cover FROM listing_images WHERE listing_id = ? ORDER BY sort_order ASC',
      [req.params.id]
    );
    listing.images = imagesResult.rows;

    // Fallback: if no images in new table but image_path exists
    if (listing.images.length === 0 && listing.image_path) {
      listing.images = [{ id: 0, image_path: listing.image_path, sort_order: 0, is_cover: 1 }];
    }

    if (!isMitarbeiter) {
      const { custom_price, notes, sold_price, view_count, ...safe } = listing;
      return res.json(safe);
    }

    if (listing.catalog_id) {
      const catRes = await pool.query('SELECT * FROM vehicle_catalog WHERE id = ?', [listing.catalog_id]);
      if (catRes.rows[0]) listing.catalog = catRes.rows[0];
    }
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** POST /api/listings */
router.post('/', requireAuth, requireRole('mitarbeiter'), upload.single('image'), async (req, res) => {
  const { catalog_id, brand, model, plate, category, custom_price, discount_pct, notes, image_base64, images_base64 } = req.body;
  if (!brand || !model) return res.status(400).json({ error: 'Marke und Modell erforderlich.' });

  let imagePath = null;
  if (req.file) imagePath = `/uploads/${req.file.filename}`;
  else if (image_base64) imagePath = await saveBase64Image(image_base64).catch(() => null);

  try {
    const created = await pool.query(
      "INSERT INTO listings (catalog_id, seller_id, brand, model, plate, category, custom_price, discount_pct, notes, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
      [catalog_id || null, req.user.id, brand, model, plate || null, category || null,
       custom_price ? toInt(custom_price) : null, discount_pct ? parseFloat(discount_pct) : 0, notes || null, imagePath]
    );
    const listingId = created.rows[0].id;

    // Save images to listing_images table
    const allImages = [];
    if (imagePath) allImages.push(imagePath);

    // Parse multi-image array
    let extraImages = [];
    if (images_base64) {
      try { extraImages = JSON.parse(images_base64); } catch { extraImages = []; }
    }
    for (const b64 of extraImages) {
      const p = await saveBase64Image(b64).catch(() => null);
      if (p) allImages.push(p);
    }

    const coverIdx = req.body.cover_index !== undefined ? toInt(req.body.cover_index) : 0;

    for (let i = 0; i < allImages.length; i++) {
      await pool.query(
        'INSERT INTO listing_images (listing_id, image_path, sort_order, is_cover) VALUES (?, ?, ?, ?)',
        [listingId, allImages[i], i, i === coverIdx ? 1 : 0]
      );
    }

    if (coverIdx > 0 && allImages[coverIdx]) {
      await pool.query('UPDATE listings SET image_path = ? WHERE id = ?', [allImages[coverIdx], listingId]);
    }

    await logAction(req.user.id, 'listing_created', 'listing', listingId, { brand, model, plate }, req.ip);

    // Auto-match open vehicle requests for this brand+model
    let matchedRequestsCount = 0;
    try {
      const matchingRequests = await pool.query(
        `SELECT id FROM vehicle_requests WHERE status = 'open' AND LOWER(brand) = LOWER(?) AND LOWER(model) = LOWER(?)`,
        [brand, model]
      );
      if (matchingRequests.rows.length > 0) {
        matchedRequestsCount = matchingRequests.rows.length;
        for (const req_row of matchingRequests.rows) {
          await pool.query(
            `UPDATE vehicle_requests SET status = 'found', matched_listing_id = ?, handled_by = ?, updated_at = datetime('now') WHERE id = ?`,
            [listingId, req.user.id, req_row.id]
          );
        }
        console.log(`🔔 Auto-matched ${matchedRequestsCount} vehicle request(s) for ${brand} ${model}`);
      }
    } catch (matchErr) {
      console.error('Auto-match vehicle requests error:', matchErr);
    }

    res.status(201).json({ ...created.rows[0], matched_requests_count: matchedRequestsCount });
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen.' });
  }
});

/** PUT /api/listings/:id */
router.put('/:id', requireAuth, requireRole('mitarbeiter'), upload.single('image'), async (req, res) => {
  const listing = await getListingById(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Nicht gefunden.' });
  if (!canManageListing(listing, req.user)) return res.status(403).json({ error: 'Keine Berechtigung.' });

  const { brand, model, plate, category, status, custom_price, discount_pct, notes, image_base64 } = req.body;

  let imagePath;
  if (req.file) imagePath = `/uploads/${req.file.filename}`;
  else if (image_base64) imagePath = await saveBase64Image(image_base64).catch(() => null);

  const sets = [];
  const params = [];
  const add = (col, val) => { sets.push(`${col} = ?`); params.push(val); };

  if (brand !== undefined) add('brand', brand);
  if (model !== undefined) add('model', model);
  if (plate !== undefined) add('plate', plate);
  if (category !== undefined) add('category', category);
  if (status !== undefined) add('status', status);
  if (custom_price !== undefined) add('custom_price', toInt(custom_price));
  if (discount_pct !== undefined) add('discount_pct', parseFloat(discount_pct));
  if (notes !== undefined) add('notes', notes);
  if (imagePath !== undefined) add('image_path', imagePath);
  if (req.body.is_featured !== undefined) add('is_featured', req.body.is_featured ? 1 : 0);
  if (sets.length === 0) return res.status(400).json({ error: 'Keine Änderungen.' });

  try {
    params.push(req.params.id);
    await pool.query(`UPDATE listings SET ${sets.join(', ')} WHERE id = ?`, params);
    const updated = await pool.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    const upRow = updated.rows[0];
    await logAction(req.user.id, 'listing_updated', 'listing', toId(req.params.id), {
      brand: upRow.brand,
      model: upRow.model,
      plate: upRow.plate,
      status: upRow.status,
      custom_price: upRow.custom_price
    }, req.ip);
    res.json(upRow);
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** PUT /api/listings/:id/sell */
router.put('/:id/sell', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  const { sold_to_name, sold_price, on_behalf_of } = req.body;
  try {
    const listing = await pool.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    if (!listing.rows[0]) return res.status(404).json({ error: 'Nicht gefunden.' });

    await pool.query(
      "UPDATE listings SET status = 'sold', sold_at = datetime('now'), sold_by = ?, sold_to_name = ?, sold_price = ? WHERE id = ?",
      [req.user.id, sold_to_name || null, sold_price ? toInt(sold_price) : null, req.params.id]
    );

    if (on_behalf_of && toId(on_behalf_of) !== req.user.id && sold_price) {
      await pool.query(
        "INSERT INTO vault_entries (listing_id, owner_id, sold_by_id, amount, status) VALUES (?, ?, ?, ?, 'pending')",
        [req.params.id, toId(on_behalf_of), req.user.id, toInt(sold_price)]
      );
    }

    await logAction(req.user.id, 'listing_sold', 'listing', toId(req.params.id), { sold_to_name, sold_price }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** DELETE /api/listings/:id */
router.delete('/:id', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  const listing = await getListingById(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Nicht gefunden.' });
  if (!canManageListing(listing, req.user)) return res.status(403).json({ error: 'Keine Berechtigung.' });

  try {
    await pool.query('DELETE FROM listings WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'listing_deleted', 'listing', toId(req.params.id), { brand: listing.brand, model: listing.model }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** PUT /api/listings/:id/feature — Toggle featured status */
router.put('/:id/feature', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const listing = await getListingById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Nicht gefunden.' });
    if (!canManageListing(listing, req.user)) return res.status(403).json({ error: 'Keine Berechtigung.' });

    const newValue = listing.is_featured ? 0 : 1;

    // Check max 2 featured per seller
    if (newValue === 1) {
      const countRes = await pool.query(
        'SELECT COUNT(*) as count FROM listings WHERE seller_id = ? AND is_featured = 1',
        [listing.seller_id]
      );
      if (toCount(countRes.rows[0].count) >= 2) {
        return res.status(400).json({ error: 'Maximal 2 Fahrzeuge k\u00f6nnen als Featured markiert werden.' });
      }
    }

    await pool.query('UPDATE listings SET is_featured = ? WHERE id = ?', [newValue, req.params.id]);
    await logAction(req.user.id, 'listing_updated', 'listing', toId(req.params.id), { is_featured: newValue }, req.ip);
    res.json({ success: true, is_featured: newValue });
  } catch (err) {
    console.error('Feature toggle error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

// ─── IMAGE MANAGEMENT ────────────────────────────────────────────────────

/** POST /api/listings/:id/images — Upload image(s) to a listing */
router.post('/:id/images', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const listing = await getListingById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Nicht gefunden.' });
    if (!canManageListing(listing, req.user)) return res.status(403).json({ error: 'Keine Berechtigung.' });

    // Check max 8 images
    const countRes = await pool.query('SELECT COUNT(*) as count FROM listing_images WHERE listing_id = ?', [req.params.id]);
    const currentCount = toCount(countRes.rows[0].count);

    const { image_base64 } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'Kein Bild.' });

    if (currentCount >= 8) {
      return res.status(400).json({ error: 'Maximal 8 Bilder pro Fahrzeug.' });
    }

    const imagePath = await saveBase64Image(image_base64).catch(() => null);
    if (!imagePath) return res.status(400).json({ error: 'Bild konnte nicht gespeichert werden.' });

    const isCover = currentCount === 0 ? 1 : 0;
    await pool.query(
      'INSERT INTO listing_images (listing_id, image_path, sort_order, is_cover) VALUES (?, ?, ?, ?)',
      [req.params.id, imagePath, currentCount, isCover]
    );

    // Also update legacy image_path if this is the cover
    if (isCover) {
      await pool.query('UPDATE listings SET image_path = ? WHERE id = ?', [imagePath, req.params.id]);
    }

    const images = await pool.query('SELECT * FROM listing_images WHERE listing_id = ? ORDER BY sort_order', [req.params.id]);
    res.json(images.rows);
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** DELETE /api/listings/:id/images/:imageId — Delete single image */
router.delete('/:id/images/:imageId', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const listing = await getListingById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Nicht gefunden.' });
    if (!canManageListing(listing, req.user)) return res.status(403).json({ error: 'Keine Berechtigung.' });

    const image = await pool.query('SELECT * FROM listing_images WHERE id = ? AND listing_id = ?', [req.params.imageId, req.params.id]);
    if (!image.rows[0]) return res.status(404).json({ error: 'Bild nicht gefunden.' });

    // Delete physical file
    try {
      const { unlink } = await import('fs/promises');
      const filePath = path.join(process.cwd(), image.rows[0].image_path);
      await unlink(filePath).catch(() => {});
    } catch {}

    await pool.query('DELETE FROM listing_images WHERE id = ?', [req.params.imageId]);

    // If deleted image was cover, make first remaining image the cover
    if (image.rows[0].is_cover) {
      const remaining = await pool.query('SELECT id FROM listing_images WHERE listing_id = ? ORDER BY sort_order LIMIT 1', [req.params.id]);
      if (remaining.rows[0]) {
        await pool.query('UPDATE listing_images SET is_cover = 1 WHERE id = ?', [remaining.rows[0].id]);
        const newCover = await pool.query('SELECT image_path FROM listing_images WHERE id = ?', [remaining.rows[0].id]);
        await pool.query('UPDATE listings SET image_path = ? WHERE id = ?', [newCover.rows[0].image_path, req.params.id]);
      } else {
        await pool.query('UPDATE listings SET image_path = NULL WHERE id = ?', [req.params.id]);
      }
    }

    const images = await pool.query('SELECT * FROM listing_images WHERE listing_id = ? ORDER BY sort_order', [req.params.id]);
    res.json(images.rows);
  } catch (err) {
    console.error('Image delete error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** PUT /api/listings/:id/images/:imageId/cover — Set as cover image */
router.put('/:id/images/:imageId/cover', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const listing = await getListingById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Nicht gefunden.' });
    if (!canManageListing(listing, req.user)) return res.status(403).json({ error: 'Keine Berechtigung.' });

    // Unset all covers for this listing
    await pool.query('UPDATE listing_images SET is_cover = 0 WHERE listing_id = ?', [req.params.id]);
    // Set new cover
    await pool.query('UPDATE listing_images SET is_cover = 1 WHERE id = ? AND listing_id = ?', [req.params.imageId, req.params.id]);

    // Update legacy image_path
    const coverImg = await pool.query('SELECT image_path FROM listing_images WHERE id = ?', [req.params.imageId]);
    if (coverImg.rows[0]) {
      await pool.query('UPDATE listings SET image_path = ? WHERE id = ?', [coverImg.rows[0].image_path, req.params.id]);
    }

    const images = await pool.query('SELECT * FROM listing_images WHERE listing_id = ? ORDER BY sort_order', [req.params.id]);
    res.json(images.rows);
  } catch (err) {
    console.error('Cover set error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** PUT /api/listings/:id/images/reorder — Reorder images */
router.put('/:id/images/reorder', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const listing = await getListingById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Nicht gefunden.' });
    if (!canManageListing(listing, req.user)) return res.status(403).json({ error: 'Keine Berechtigung.' });

    const { order } = req.body; // array of image IDs in new order
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Ung\u00fcltiges Format.' });

    for (let i = 0; i < order.length; i++) {
      await pool.query('UPDATE listing_images SET sort_order = ? WHERE id = ? AND listing_id = ?', [i, order[i], req.params.id]);
    }

    const images = await pool.query('SELECT * FROM listing_images WHERE listing_id = ? ORDER BY sort_order', [req.params.id]);
    res.json(images.rows);
  } catch (err) {
    console.error('Reorder error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

export default router;
