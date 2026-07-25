/**
 * Database abstraction layer.
 * Uses PostgreSQL when DB_HOST is configured, otherwise falls back to SQLite.
 * Provides a unified query interface: db.query(sql, params) → { rows: [...] }
 */

let db;
let isPostgres = false;

const DB_HOST = process.env.DB_HOST;
const DATABASE_URL = process.env.DATABASE_URL;

if (DB_HOST || DATABASE_URL) {
  // ── PostgreSQL ──
  const pg = await import('pg');
  const { Pool } = pg.default;

  const connection = DATABASE_URL
    ? { connectionString: DATABASE_URL }
    : {
        host: DB_HOST,
        port: Number.parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'larrys',
        user: process.env.DB_USER || 'larrys',
        password: process.env.DB_PASSWORD || 'larrys_secret',
      };
  const tls = process.env.DB_SSL === 'true'
    ? {
        ssl: {
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}),
        },
      }
    : {};

  const pool = new Pool({
    ...connection,
    ...tls,
    connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '5000', 10),
    query_timeout: Number.parseInt(process.env.DB_QUERY_TIMEOUT_MS || '15000', 10),
    statement_timeout: Number.parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '15000', 10),
    idleTimeoutMillis: 30000,
    max: Number.parseInt(process.env.DB_POOL_MAX || '20', 10),
  });

  pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error);
  });

  isPostgres = true;

  db = {
    query: async (sql, params) => {
      let pgSql = sql;
      if (pgSql) {
        // Convert SQLite datetime('now') to PostgreSQL string formatted datetime
        pgSql = pgSql.replace(/datetime\('now'\)/gi, "to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')");
        
        // Convert SQLite datetime('now', '-' || ? || ' seconds')
        pgSql = pgSql.replace(/datetime\('now',\s*'-'\s*\|\|\s*\?\s*\|\|\s*' seconds'\)/gi, "to_char(NOW() - (? || ' seconds')::interval, 'YYYY-MM-DD HH24:MI:SS')");
        
        // Convert SQLite date('now') to PostgreSQL string formatted date
        pgSql = pgSql.replace(/date\('now'\)/gi, "to_char(CURRENT_DATE, 'YYYY-MM-DD')");
        
        // Convert SQLite date('now', 'start of month') to PostgreSQL string formatted start of month
        pgSql = pgSql.replace(/date\('now',\s*'start of month'\)/gi, "to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM-DD')");
        
        // Convert SQLite date('now', 'start of month', '-1 month') to PostgreSQL string formatted start of last month
        pgSql = pgSql.replace(/date\('now',\s*'start of month',\s*'-1 month'\)/gi, "to_char(date_trunc('month', CURRENT_DATE) - INTERVAL '1 month', 'YYYY-MM-DD')");

        // Convert SQLite ? placeholders to PostgreSQL $1, $2
        if (params && params.length > 0) {
          let i = 1;
          pgSql = pgSql.replace(/\?/g, () => `$${i++}`);
        }
      }
      return pool.query(pgSql, params);
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
  let migrationLockAcquired = false;
  try {
    if (isPostgres) {
      await client.query(`SELECT pg_advisory_lock(hashtext('larrys:database-migrations'))`);
      migrationLockAcquired = true;

      // Define custom date(text) helper function for PostgreSQL
      await client.query(`
        CREATE OR REPLACE FUNCTION date(t text) RETURNS date AS $$
        BEGIN
          RETURN t::date;
        EXCEPTION WHEN OTHERS THEN
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
      `);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        discord_id    TEXT UNIQUE NOT NULL,
        username      TEXT NOT NULL,
        display_name  TEXT,
        first_name    TEXT,
        last_name     TEXT,
        avatar_url    TEXT,
        role          TEXT NOT NULL DEFAULT 'kunde',
        is_blocked    INTEGER DEFAULT 0,
        blocked_by    INTEGER,
        blocked_at    TEXT,
        created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login    TEXT DEFAULT CURRENT_TIMESTAMP,
        discord_notifications INTEGER DEFAULT 1,
        has_completed_profile INTEGER DEFAULT 0
      )
    `);

    // Create session table if not exists (preserves user logins across restarts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid     TEXT NOT NULL PRIMARY KEY,
        sess    JSON NOT NULL,
        expire  TIMESTAMPTZ NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_catalog (
        id                    SERIAL PRIMARY KEY,
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
        id              SERIAL PRIMARY KEY,
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
        sold_price      INTEGER,
        is_featured     INTEGER DEFAULT 0
      )
    `);

    // Migration: Add is_featured if it doesn't exist on older DBs
    try {
      await client.query(`ALTER TABLE listings ADD COLUMN is_featured INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists — ignore
    }

    // Multi-image support
    await client.query(`
      CREATE TABLE IF NOT EXISTS listing_images (
        id          SERIAL PRIMARY KEY,
        listing_id  INTEGER NOT NULL,
        image_path  TEXT NOT NULL,
        sort_order  INTEGER DEFAULT 0,
        is_cover    INTEGER DEFAULT 0,
        uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Move existing listings.image_path into listing_images (one-time)
    try {
      const existing = await client.query(
        `SELECT id, image_path FROM listings WHERE image_path IS NOT NULL AND image_path != ''`
      );
      for (const row of existing.rows) {
        const already = await client.query(
          `SELECT id FROM listing_images WHERE listing_id = ? AND image_path = ?`,
          [row.id, row.image_path]
        );
        if (already.rows.length === 0) {
          await client.query(
            `INSERT INTO listing_images (listing_id, image_path, sort_order, is_cover) VALUES (?, ?, 0, 1)`,
            [row.id, row.image_path]
          );
        }
      }
    } catch (e) {
      console.error('Image migration error (non-critical):', e.message);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id              SERIAL PRIMARY KEY,
        listing_id      INTEGER NOT NULL,
        customer_id     INTEGER NOT NULL,
        assigned_to     INTEGER,
        status          TEXT DEFAULT 'open',
        priority        TEXT DEFAULT 'normal',
        created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
        closed_at       TEXT,
        last_read_customer TEXT DEFAULT CURRENT_TIMESTAMP,
        last_read_staff    TEXT DEFAULT CURRENT_TIMESTAMP,
        erp_status      TEXT DEFAULT 'open',
        contract_price  INTEGER DEFAULT 0,
        contract_payment_type TEXT,
        contract_created_at TEXT
      )
    `);

    try { await client.query(`ALTER TABLE users ADD COLUMN discord_notifications INTEGER DEFAULT 1`); } catch (e) {}
    try { await client.query(`ALTER TABLE tickets ADD COLUMN priority TEXT DEFAULT 'normal'`); } catch (e) {}
    try { await client.query(`ALTER TABLE tickets ADD COLUMN last_read_customer TEXT DEFAULT CURRENT_TIMESTAMP`); } catch (e) {}
    try { await client.query(`ALTER TABLE tickets ADD COLUMN last_read_staff TEXT DEFAULT CURRENT_TIMESTAMP`); } catch (e) {}
    try { await client.query(`ALTER TABLE tickets ADD COLUMN erp_status TEXT DEFAULT 'open'`); } catch (e) {}
    try { await client.query(`ALTER TABLE tickets ADD COLUMN contract_price INTEGER DEFAULT 0`); } catch (e) {}
    try { await client.query(`ALTER TABLE tickets ADD COLUMN contract_payment_type TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE tickets ADD COLUMN contract_created_at TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE users ADD COLUMN has_completed_profile INTEGER DEFAULT 0`); } catch (e) {}
    try { await client.query(`ALTER TABLE users ADD COLUMN first_name TEXT`); } catch (e) {}
    try { await client.query(`ALTER TABLE users ADD COLUMN last_name TEXT`); } catch (e) {}

    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id          SERIAL PRIMARY KEY,
        ticket_id   INTEGER NOT NULL,
        sender_id   INTEGER NOT NULL,
        message     TEXT NOT NULL,
        created_at  TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vault_entries (
        id              SERIAL PRIMARY KEY,
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
        id          SERIAL PRIMARY KEY,
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
      CREATE TABLE IF NOT EXISTS reviews (
        id            SERIAL PRIMARY KEY,
        listing_id    INTEGER NOT NULL,
        seller_id     INTEGER NOT NULL,
        customer_id   INTEGER NOT NULL,
        rating        INTEGER NOT NULL,
        comment       TEXT,
        created_at    TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews(listing_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_requests (
        id                  SERIAL PRIMARY KEY,
        customer_id         INTEGER NOT NULL,
        brand               TEXT NOT NULL,
        model               TEXT NOT NULL,
        notes               TEXT,
        status              TEXT DEFAULT 'open',
        matched_listing_id  INTEGER,
        handled_by          INTEGER,
        created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_request_messages (
        id          SERIAL PRIMARY KEY,
        request_id  INTEGER NOT NULL,
        sender_id   INTEGER NOT NULL,
        message     TEXT NOT NULL,
        created_at  TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL,
        action      TEXT NOT NULL,
        created_at  TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Performance Indexes for GTA RP Tablet (CEF) optimization
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_featured ON listings(is_featured)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_status_listed ON listings(status, listed_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_featured_status ON listings(is_featured, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_seller_status ON listings(seller_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listing_images_order ON listing_images(listing_id, sort_order)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vault_owner ON vault_entries(owner_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vehicle_requests_customer ON vehicle_requests(customer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vehicle_requests_status ON vehicle_requests(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vehicle_request_messages_request ON vehicle_request_messages(request_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC)`);

    console.log('✅ Database migrations complete');
  } finally {
    if (migrationLockAcquired) {
      await client.query(`SELECT pg_advisory_unlock(hashtext('larrys:database-migrations'))`);
    }
    if (client.release) client.release();
  }
}

export async function seed() {
  console.log('ℹ️ Database seeding is disabled for a clean production setup.');
}

export default db;
// Alias so `import pool from '../db.js'` still works in route files
export { db as pool };
