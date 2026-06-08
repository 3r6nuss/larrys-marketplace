import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const toInt = (value) => Number.parseInt(value, 10);

async function getCarById(carId) {
  const result = await pool.query('SELECT * FROM cars WHERE id = $1', [carId]);
  return result.rows[0] || null;
}

function getUploadedImagePath(file) {
  return file ? `/uploads/${file.filename}` : null;
}

function parseTuningInput(tuning, fallback) {
  if (tuning === undefined || tuning === null) {
    return fallback;
  }

  try {
    return typeof tuning === 'string' ? tuning : JSON.stringify(tuning);
  } catch {
    return fallback;
  }
}

function pushFieldUpdate({ fields, params, idx, key, value, transform, cast }) {
  if (value === undefined) {
    return idx;
  }

  const paramValue = transform ? transform(value) : value;
  const castSuffix = cast || '';
  fields.push(`${key} = $${idx}${castSuffix}`);
  params.push(paramValue);
  return idx + 1;
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `car-${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilddateien erlaubt.'));
    }
  }
});

/**
 * GET /api/cars
 * List all cars with optional filters and sorting.
 * Query params: seller, category, sort (newest|price_asc|price_desc), status
 */
router.get('/', requireAuth, async (req, res) => {
  const { seller, category, sort, status } = req.query;

  let query = 'SELECT * FROM cars WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (seller) {
    query += ` AND seller = $${paramIndex++}`;
    params.push(seller);
  }
  if (category) {
    query += ` AND category = $${paramIndex++}`;
    params.push(category);
  }
  if (status) {
    query += ` AND status = $${paramIndex++}`;
    params.push(status);
  }

  // Sorting
  switch (sort) {
    case 'price_asc':
      query += ' ORDER BY price ASC';
      break;
    case 'price_desc':
      query += ' ORDER BY price DESC';
      break;
    case 'newest':
    default:
      query += ' ORDER BY id DESC';
      break;
  }

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get cars error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Fahrzeuge.' });
  }
});

/**
 * GET /api/cars/:id
 * Get a single car by ID.
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const car = await getCarById(req.params.id);
    if (!car) {
      return res.status(404).json({ error: 'Fahrzeug nicht gefunden.' });
    }
    res.json(car);
  } catch (err) {
    console.error('Get car error:', err);
    res.status(500).json({ error: 'Fehler beim Laden des Fahrzeugs.' });
  }
});

/**
 * POST /api/cars
 * Create a new car listing with optional image upload.
 */
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  const { seller, brand, model, plate, phone, price, price_label, category, status, tuning } = req.body;

  const imagePath = getUploadedImagePath(req.file);
  const tuningData = parseTuningInput(tuning, '[]');

  try {
    const result = await pool.query(
      `INSERT INTO cars (seller, brand, model, plate, phone, price, price_label, category, status, tuning, image_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
       RETURNING *`,
      [seller, brand, model, plate, phone || null, toInt(price), price_label || `$ ${price}`, category, status || 'available', tuningData, imagePath]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create car error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Inserats.' });
  }
});

/**
 * PUT /api/cars/:id
 * Update a car listing.
 */
router.put('/:id', requireAuth, upload.single('image'), async (req, res) => {
  const { seller, brand, model, plate, phone, price, price_label, category, status, tuning } = req.body;

  const imagePath = req.file ? getUploadedImagePath(req.file) : undefined;
  const tuningData = parseTuningInput(tuning, undefined);

  try {
    // Build dynamic UPDATE query
    const fields = [];
    const params = [];
    let idx = 1;

    idx = pushFieldUpdate({ fields, params, idx, key: 'seller', value: seller });
    idx = pushFieldUpdate({ fields, params, idx, key: 'brand', value: brand });
    idx = pushFieldUpdate({ fields, params, idx, key: 'model', value: model });
    idx = pushFieldUpdate({ fields, params, idx, key: 'plate', value: plate });
    idx = pushFieldUpdate({ fields, params, idx, key: 'phone', value: phone });
    idx = pushFieldUpdate({ fields, params, idx, key: 'price', value: price, transform: toInt });
    idx = pushFieldUpdate({ fields, params, idx, key: 'price_label', value: price_label });
    idx = pushFieldUpdate({ fields, params, idx, key: 'category', value: category });
    idx = pushFieldUpdate({ fields, params, idx, key: 'status', value: status });
    idx = pushFieldUpdate({ fields, params, idx, key: 'tuning', value: tuningData, cast: '::jsonb' });
    idx = pushFieldUpdate({ fields, params, idx, key: 'image_path', value: imagePath });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren.' });
    }

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE cars SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fahrzeug nicht gefunden.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update car error:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Inserats.' });
  }
});

/**
 * PUT /api/cars/:id/status
 * Quick status update (available, reserved, sold).
 */
router.put('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['available', 'reserved', 'sold'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status muss einer von ${validStatuses.join(', ')} sein.` });
  }

  try {
    const result = await pool.query(
      'UPDATE cars SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fahrzeug nicht gefunden.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update car status error:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Status.' });
  }
});

/**
 * DELETE /api/cars/:id
 * Delete a car listing.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM cars WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fahrzeug nicht gefunden.' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Delete car error:', err);
    res.status(500).json({ error: 'Fehler beim Löschen des Inserats.' });
  }
});

export default router;
