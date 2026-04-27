/**
 * Database abstraction layer.
 * Uses PostgreSQL when DB_HOST is configured, otherwise falls back to SQLite.
 * Provides a unified query interface: db.query(sql, params) → { rows: [...] }
 */

let db;
let isPostgres = false;

const DB_HOST = process.env.DB_HOST;

if (DB_HOST) {
  // ── PostgreSQL ──
  const pg = await import('pg');
  const { Pool } = pg.default;

  const pool = new Pool({
    host: DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'larrys',
    user: process.env.DB_USER || 'larrys',
    password: process.env.DB_PASSWORD || 'larrys_secret',
  });

  isPostgres = true;

  db = {
    query: async (sql, params) => {
      // Convert $1, $2 placeholder syntax (PG) — already in PG format, pass through
      return pool.query(sql, params);
    },
    connect: () => pool.connect(),
    pool,
  };

  console.log('🐘 Using PostgreSQL');
} else {
  // ── SQLite Fallback ──
  const Database = (await import('better-sqlite3')).default;
  const path = await import('path');

  const dbPath = path.join(process.cwd(), 'larrys.db');
  const sqlite = new Database(dbPath);

  // Enable WAL mode for better performance
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Track auto-increment IDs per table for SERIAL emulation
  let paramCounter = 0;

  db = {
    query: async (sql, params = []) => {
      // Convert PostgreSQL-style $1, $2... to SQLite's ?
      let convertedSql = sql;
      if (params.length > 0) {
        let i = 0;
        convertedSql = sql.replace(/\$(\d+)/g, () => '?');
      }

      // Handle PostgreSQL-specific syntax for SQLite
      convertedSql = convertedSql
        // SERIAL PRIMARY KEY → INTEGER PRIMARY KEY AUTOINCREMENT
        .replace(/SERIAL\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        // TIMESTAMPTZ → TEXT
        .replace(/TIMESTAMPTZ/gi, 'TEXT')
        // TIMESTAMP\(6\) → TEXT
        .replace(/TIMESTAMP\(\d+\)/gi, 'TEXT')
        // JSONB → TEXT
        .replace(/JSONB/gi, 'TEXT')
        // DEFAULT NOW() → DEFAULT CURRENT_TIMESTAMP
        .replace(/DEFAULT\s+NOW\(\)/gi, "DEFAULT CURRENT_TIMESTAMP")
        // NOW() in queries → datetime('now')
        .replace(/\bNOW\(\)/gi, "datetime('now')")
        // NUMERIC(5,2) → REAL
        .replace(/NUMERIC\(\d+,\d+\)/gi, 'REAL')
        // BOOLEAN → INTEGER
        .replace(/\bBOOLEAN\b/gi, 'INTEGER')
        // DEFAULT FALSE → DEFAULT 0
        .replace(/DEFAULT\s+FALSE/gi, 'DEFAULT 0')
        // DEFAULT TRUE → DEFAULT 1
        .replace(/DEFAULT\s+TRUE/gi, 'DEFAULT 1')
        // VARCHAR → TEXT
        .replace(/VARCHAR/gi, 'TEXT')
        // ::jsonb cast → remove
        .replace(/::jsonb/gi, '')
        // ::text → remove
        .replace(/::text/gi, '')
        // ILIKE → LIKE (SQLite is case-insensitive for ASCII by default)
        .replace(/\bILIKE\b/gi, 'LIKE')
        // ON CONFLICT ... DO UPDATE SET → SQLite upsert
        // INTERVAL syntax → use datetime functions
        .replace(/NOW\(\)\s*-\s*INTERVAL\s*'1 second'\s*\*\s*\?/gi, "datetime('now', '-' || ? || ' seconds')")
        // date_trunc('month', NOW()) → date('now', 'start of month')
        .replace(/date_trunc\('month',\s*datetime\('now'\)\)/gi, "date('now', 'start of month')")
        // CREATE INDEX IF NOT EXISTS
        // Remove REFERENCES constraints (SQLite handles these differently)
        .replace(/REFERENCES\s+\w+\(\w+\)/gi, '')
        // RETURNING * → handled separately
        ;

      // Handle multiple statements (migrations) by splitting on ;
      const statements = convertedSql.split(';').map(s => s.trim()).filter(s => s.length > 0);

      if (statements.length > 1 && params.length === 0) {
        // Multiple statements (migration) — execute each separately
        for (const stmt of statements) {
          try {
            sqlite.exec(stmt);
          } catch (err) {
            // Ignore errors from duplicate CREATE TABLE / CREATE INDEX
            if (!err.message.includes('already exists')) {
              console.error('SQLite migration error:', err.message, '\nStatement:', stmt);
            }
          }
        }
        return { rows: [] };
      }

      // Single statement
      const trimmed = convertedSql.replace(/;+$/, '').trim();
      const isSelect = /^\s*(SELECT|WITH)/i.test(trimmed);
      const hasReturning = /RETURNING\s+/i.test(trimmed);

      try {
        if (isSelect) {
          const rows = sqlite.prepare(trimmed).all(...params);
          return { rows };
        } else if (hasReturning) {
          // SQLite doesn't support RETURNING — execute then select
          const withoutReturning = trimmed.replace(/\s+RETURNING\s+.*/i, '');
          const info = sqlite.prepare(withoutReturning).run(...params);

          // Try to get the inserted/updated row
          if (/^\s*INSERT/i.test(trimmed)) {
            // Get the table name from INSERT INTO
            const tableMatch = trimmed.match(/INSERT\s+INTO\s+(\w+)/i);
            if (tableMatch) {
              const rows = sqlite.prepare(`SELECT * FROM ${tableMatch[1]} WHERE rowid = ?`).all(info.lastInsertRowid);
              return { rows };
            }
          } else if (/^\s*UPDATE/i.test(trimmed)) {
            // For update, re-select by the WHERE clause
            const tableMatch = trimmed.match(/UPDATE\s+(\w+)/i);
            if (tableMatch && params.length > 0) {
              // The last param is usually the ID
              const rows = sqlite.prepare(`SELECT * FROM ${tableMatch[1]} WHERE id = ?`).all(params[params.length - 1]);
              return { rows };
            }
          } else if (/^\s*DELETE/i.test(trimmed)) {
            return { rows: info.changes > 0 ? [{ id: params[0] }] : [] };
          }
          return { rows: [] };
        } else {
          const info = sqlite.prepare(trimmed).run(...params);
          return { rows: [], rowCount: info.changes };
        }
      } catch (err) {
        // Handle ON CONFLICT for upserts — SQLite supports this natively
        if (err.message.includes('UNIQUE constraint failed') || err.message.includes('ON CONFLICT')) {
          console.error('SQLite query error:', err.message);
        }
        throw err;
      }
    },

    connect: async () => {
      // Emulate pg client interface
      return {
        query: async (sql, params) => db.query(sql, params),
        release: () => {},
      };
    },

    pool: null,
    sqlite,
  };

  console.log(`📦 Using SQLite: ${dbPath}`);
}

// ── Migrations ──

export async function migrate() {
  const client = db.connect ? await db.connect() : db;
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id    TEXT UNIQUE NOT NULL,
        username      TEXT NOT NULL,
        display_name  TEXT,
        avatar_url    TEXT,
        role          TEXT NOT NULL DEFAULT 'kunde',
        is_blocked    INTEGER DEFAULT 0,
        blocked_by    INTEGER,
        blocked_at    TEXT,
        created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login    TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid     TEXT NOT NULL PRIMARY KEY,
        sess    TEXT NOT NULL,
        expire  TEXT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_catalog (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        brand                 TEXT NOT NULL,
        model                 TEXT NOT NULL,
        coin_price            INTEGER DEFAULT 0,
        min_dollar_price      INTEGER DEFAULT 0,
        max_dollar_price      INTEGER DEFAULT 0,
        dealer_price          INTEGER DEFAULT 0,
        min_sell_price        INTEGER DEFAULT 0,
        max_sell_price        INTEGER DEFAULT 0,
        created_at            TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        catalog_id      INTEGER,
        seller_id       INTEGER NOT NULL,
        brand           TEXT NOT NULL,
        model           TEXT NOT NULL,
        plate           TEXT,
        category        TEXT,
        status          TEXT DEFAULT 'available',
        custom_price    INTEGER,
        discount_pct    REAL DEFAULT 0,
        image_path      TEXT,
        notes           TEXT,
        view_count      INTEGER DEFAULT 0,
        listed_at       TEXT DEFAULT CURRENT_TIMESTAMP,
        sold_at         TEXT,
        sold_by         INTEGER,
        sold_to_name    TEXT,
        sold_price      INTEGER
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id      INTEGER NOT NULL,
        customer_id     INTEGER NOT NULL,
        assigned_to     INTEGER,
        status          TEXT DEFAULT 'open',
        created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
        closed_at       TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id   INTEGER NOT NULL,
        sender_id   INTEGER NOT NULL,
        message     TEXT NOT NULL,
        created_at  TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vault_entries (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id      INTEGER,
        owner_id        INTEGER NOT NULL,
        sold_by_id      INTEGER NOT NULL,
        amount          INTEGER NOT NULL,
        status          TEXT DEFAULT 'pending',
        note            TEXT,
        created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
        paid_out_at     TEXT,
        confirmed_by    INTEGER
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER,
        action      TEXT NOT NULL,
        entity_type TEXT,
        entity_id   INTEGER,
        details     TEXT DEFAULT '{}',
        ip_address  TEXT,
        created_at  TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL,
        action      TEXT NOT NULL,
        created_at  TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (client.release) client.release();
    console.log('✅ Database migrations complete');
  } catch (err) {
    if (client.release) client.release();
    throw err;
  }
}

export async function seed() {
  // Seed some demo listings if empty
  const check = await db.query('SELECT COUNT(*) as count FROM listings');
  if (parseInt(check.rows[0].count) === 0) {
    // First ensure we have a dev user
    await db.query(
      `INSERT OR IGNORE INTO users (discord_id, username, display_name, role)
       VALUES ('dev_mitarbeiter', 'dev_mitarbeiter', 'Dev Mitarbeiter', 'mitarbeiter')`
    );

    const userRes = await db.query(`SELECT id FROM users WHERE discord_id = 'dev_mitarbeiter'`);
    const userId = userRes.rows[0]?.id || 1;

    const demoListings = [
      ['Pegassi', 'Toros CTX', 'GEB 385', 'SUV', userId],
      ['Obey', 'Tailgater S', 'JTS 349', 'Sport', userId],
      ['Vapid', 'Dominator ASP', 'LRY 001', 'Muscle', userId],
      ['Grotti', 'Itali RSX', 'RX 999', 'Sport', userId],
      ['Lampadati', 'Corsita', 'CRS 420', 'Sport', userId],
      ['Benefactor', 'Schafter V12', 'BNF 112', 'Limousine', userId],
    ];

    for (const [brand, model, plate, category, sellerId] of demoListings) {
      await db.query(
        `INSERT INTO listings (seller_id, brand, model, plate, category, status)
         VALUES (?, ?, ?, ?, ?, 'available')`,
        [sellerId, brand, model, plate, category]
      );
    }
    console.log('✅ Seeded demo listings');
  }

  // Seed catalog if empty
  const catalogCheck = await db.query('SELECT COUNT(*) as count FROM vehicle_catalog');
  if (parseInt(catalogCheck.rows[0].count) === 0) {
    const demoCatalog = [
      ['Pegassi', 'Toros CTX'], ['Pegassi', 'Zentorno'], ['Pegassi', 'Tempesta'],
      ['Obey', 'Tailgater S'], ['Obey', '10F'], ['Obey', '8F Drafter'],
      ['Vapid', 'Dominator ASP'], ['Vapid', 'Stanier'], ['Vapid', 'Sandking XL'],
      ['Grotti', 'Itali RSX'], ['Grotti', 'Turismo Omaggio'], ['Grotti', 'Stinger GT'],
      ['Lampadati', 'Corsita'], ['Lampadati', 'Casco'],
      ['Benefactor', 'Schafter V12'], ['Benefactor', 'Krieger'], ['Benefactor', 'LM87']
    ];

    for (const [brand, model] of demoCatalog) {
      await db.query(
        'INSERT INTO vehicle_catalog (brand, model) VALUES (?, ?)',
        [brand, model]
      );
    }
    console.log('✅ Seeded vehicle catalog');
  }
}

export default db;
// Alias so `import pool from '../db.js'` still works in route files
export { db as pool };
