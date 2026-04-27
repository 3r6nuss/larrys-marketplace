import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole, logAction } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/catalog
 */
router.get('/', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  const { q, brand } = req.query;
  let where = [];
  let params = [];

  if (q) { where.push('(brand LIKE ? OR model LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (brand) { where.push('brand = ?'); params.push(brand); }

  const sql = `SELECT * FROM vehicle_catalog ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY brand ASC, model ASC`;
  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get catalog error:', err);
    res.status(500).json({ error: 'Fehler beim Laden des Katalogs.' });
  }
});

/**
 * GET /api/catalog/brands
 */
router.get('/brands', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT brand FROM vehicle_catalog ORDER BY brand ASC');
    res.json(result.rows.map(r => r.brand));
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * GET /api/catalog/stats
 */
router.get('/stats', requireAuth, requireRole('mitarbeiter'), async (req, res) => {
  try {
    const total = await pool.query('SELECT COUNT(*) as count FROM vehicle_catalog');
    const brands = await pool.query('SELECT COUNT(DISTINCT brand) as count FROM vehicle_catalog');
    res.json({ total: parseInt(total.rows[0].count), brands: parseInt(brands.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

/**
 * POST /api/catalog/import
 * Import CSV (superadmin only).
 * Format: Marke;Modell;Coinpreis;Min-$-Preis;Max-$-Preis;Zwischenhändlerpreis;Min-Verkauf;Max-Verkauf
 */
router.post('/import', requireAuth, requireRole('superadmin'), async (req, res) => {
  const { csv_data, replace_existing } = req.body;
  if (!csv_data) return res.status(400).json({ error: 'CSV-Daten erforderlich.' });

  const lines = csv_data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let startIdx = 0;
  if (lines[0]?.toLowerCase().includes('marke') || lines[0]?.toLowerCase().includes('brand')) {
    startIdx = 1;
  }

  const parseNum = (s) => { const n = parseInt(String(s || '0').replace(/[^0-9-]/g, '')); return isNaN(n) ? 0 : n; };

  try {
    if (replace_existing) {
      await pool.query('DELETE FROM vehicle_catalog');
    }

    let imported = 0;
    const errors = [];

    for (let i = startIdx; i < lines.length; i++) {
      const sep = lines[i].includes(';') ? ';' : ',';
      const parts = lines[i].split(sep).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) continue;

      const [brand, model, coinPrice = '0', minDollar = '0', maxDollar = '0', dealerPrice = '0', minSell = '0', maxSell = '0'] = parts;
      if (!brand || !model) continue;

      try {
        await pool.query(
          `INSERT INTO vehicle_catalog (brand, model, coin_price, min_dollar_price, max_dollar_price, dealer_price, min_sell_price, max_sell_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [brand, model, parseNum(coinPrice), parseNum(minDollar), parseNum(maxDollar), parseNum(dealerPrice), parseNum(minSell), parseNum(maxSell)]
        );
        imported++;
      } catch (rowErr) {
        errors.push(`Zeile ${i + 1}: ${rowErr.message}`);
      }
    }

    await logAction(req.user.id, 'catalog_imported', 'system', null, { imported, replace_existing }, req.ip);
    res.json({ success: true, imported, errors: errors.slice(0, 10) });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ error: 'Fehler beim Import: ' + err.message });
  }
});

/**
 * DELETE /api/catalog
 * Clear all catalog entries (superadmin only).
 */
router.delete('/', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM vehicle_catalog');
    await logAction(req.user.id, 'catalog_cleared', 'system', null, {}, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler.' });
  }
});

export default router;
