import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { requireAuth, optionalAuth, requireRole, logAction } from '../middleware/auth.js';

const router = Router();

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

/** GET /api/listings */
router.get('/', optionalAuth, async (req, res) => {
  const { category, q, seller_id, status = 'available' } = req.query;
  let where = [];
  let params = [];

  if (category && category !== 'all') { where.push('l.category = ?'); params.push(category); }
  if (status && status !== 'all') { where.push('l.status = ?'); params.push(status); }
  if (seller_id) { where.push('l.seller_id = ?'); params.push(seller_id); }
  if (q) { where.push('(l.brand LIKE ? OR l.model LIKE ? OR l.plate LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const sql = `SELECT l.*, u.display_name as seller_name, u.avatar_url as seller_avatar
               FROM listings l LEFT JOIN users u ON l.seller_id = u.id
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY l.listed_at DESC`;
  try {
    const result = await pool.query(sql, params);
    const isMitarbeiter = req.user && ['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter'].includes(req.user.role);
    res.json(result.rows.map(l => {
      if (!isMitarbeiter) { const { custom_price, notes, sold_price, ...safe } = l; return safe; }
      return l;
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
      'SELECT l.*, u.display_name as seller_name, u.avatar_url as seller_avatar FROM listings l LEFT JOIN users u ON l.seller_id = u.id WHERE l.id = ?',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Nicht gefunden.' });

    await pool.query('UPDATE listings SET view_count = view_count + 1 WHERE id = ?', [req.params.id]);

    const listing = result.rows[0];
    const isMitarbeiter = req.user && ['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter'].includes(req.user.role);

    if (!isMitarbeiter) { const { custom_price, notes, sold_price, ...safe } = listing; return res.json(safe); }

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
  const { catalog_id, brand, model, plate, category, custom_price, discount_pct, notes, image_base64 } = req.body;
  if (!brand || !model) return res.status(400).json({ error: 'Marke und Modell erforderlich.' });

  let imagePath = null;
  if (req.file) imagePath = `/uploads/${req.file.filename}`;
  else if (image_base64) imagePath = await saveBase64Image(image_base64).catch(() => null);

  try {
    await pool.query(
      "INSERT INTO listings (catalog_id, seller_id, brand, model, plate, category, custom_price, discount_pct, notes, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [catalog_id || null, req.user.id, brand, model, plate || null, category || null,
       custom_price ? parseInt(custom_price) : null, discount_pct ? parseFloat(discount_pct) : 0, notes || null, imagePath]
    );
    const created = await pool.query(
      'SELECT * FROM listings WHERE seller_id = ? AND brand = ? AND model = ? ORDER BY listed_at DESC LIMIT 1',
      [req.user.id, brand, model]
    );
    await logAction(req.user.id, 'listing_created', 'listing', created.rows[0].id, { brand, model, plate }, req.ip);
    res.status(201).json(created.rows[0]);
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen.' });
  }
});

/** PUT /api/listings/:id */
router.put('/:id', requireAuth, requireRole('mitarbeiter'), upload.single('image'), async (req, res) => {
  const listing = await pool.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
  if (!listing.rows[0]) return res.status(404).json({ error: 'Nicht gefunden.' });

  const isOwner = listing.rows[0].seller_id === req.user.id;
  const isAdmin = ['superadmin', 'stv_admin', 'inhaber'].includes(req.user.role);
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Keine Berechtigung.' });

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
  if (custom_price !== undefined) add('custom_price', parseInt(custom_price));
  if (discount_pct !== undefined) add('discount_pct', parseFloat(discount_pct));
  if (notes !== undefined) add('notes', notes);
  if (imagePath !== undefined) add('image_path', imagePath);
  if (sets.length === 0) return res.status(400).json({ error: 'Keine Änderungen.' });

  try {
    params.push(req.params.id);
    await pool.query(`UPDATE listings SET ${sets.join(', ')} WHERE id = ?`, params);
    const updated = await pool.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'listing_updated', 'listing', parseInt(req.params.id), {}, req.ip);
    res.json(updated.rows[0]);
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
      [req.user.id, sold_to_name || null, sold_price ? parseInt(sold_price) : null, req.params.id]
    );

    if (on_behalf_of && parseInt(on_behalf_of) !== req.user.id && sold_price) {
      await pool.query(
        "INSERT INTO vault_entries (listing_id, owner_id, sold_by_id, amount, status) VALUES (?, ?, ?, ?, 'pending')",
        [req.params.id, parseInt(on_behalf_of), req.user.id, parseInt(sold_price)]
      );
    }

    await logAction(req.user.id, 'listing_sold', 'listing', parseInt(req.params.id), { sold_to_name, sold_price }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/** DELETE /api/listings/:id */
router.delete('/:id', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  const listing = await pool.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
  if (!listing.rows[0]) return res.status(404).json({ error: 'Nicht gefunden.' });

  const isOwner = listing.rows[0].seller_id === req.user.id;
  const isAdmin = ['superadmin', 'stv_admin', 'inhaber'].includes(req.user.role);
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Keine Berechtigung.' });

  try {
    await pool.query('DELETE FROM listings WHERE id = ?', [req.params.id]);
    await logAction(req.user.id, 'listing_deleted', 'listing', parseInt(req.params.id), { brand: listing.rows[0].brand, model: listing.rows[0].model }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

export default router;
