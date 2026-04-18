import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'larrys',
  user: process.env.DB_USER || 'larrys',
  password: process.env.DB_PASSWORD || 'larrys_secret',
});

/**
 * Run all migrations to create tables if they don't exist.
 */
export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id         SERIAL PRIMARY KEY,
        token      TEXT UNIQUE NOT NULL,
        label      TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS employees (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        role       TEXT NOT NULL,
        phone      TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cars (
        id          SERIAL PRIMARY KEY,
        seller      TEXT NOT NULL,
        brand       TEXT NOT NULL,
        model       TEXT NOT NULL,
        plate       TEXT NOT NULL,
        phone       TEXT,
        price       INTEGER NOT NULL,
        price_label TEXT,
        category    TEXT NOT NULL,
        status      TEXT DEFAULT 'available',
        tuning      JSONB DEFAULT '[]'::jsonb,
        image_path  TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Database migrations complete');
  } finally {
    client.release();
  }
}

/**
 * Seed initial data if tables are empty.
 */
export async function seed() {
  const client = await pool.connect();
  try {
    // Seed employees
    const empCount = await client.query('SELECT COUNT(*) FROM employees');
    if (parseInt(empCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO employees (name, role, phone, is_default) VALUES
          ('Marco Steiner', 'Inhaber', '661944', TRUE),
          ('Anna Miller', 'Manager', '445102', FALSE),
          ('Larry Dealership', 'Autohaus', '555123', FALSE),
          ('John Doe', 'Verkäufer', '123456', FALSE);
      `);
      console.log('✅ Seeded employees');
    }

    // Seed cars
    const carCount = await client.query('SELECT COUNT(*) FROM cars');
    if (parseInt(carCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO cars (seller, brand, model, plate, phone, price, price_label, category, status, tuning, image_path) VALUES
          ('Marco Steiner', 'Pegassi', 'Toros CTX', 'GEB 385', '661944', 185000, '$ 185,000', 'SUV', 'available', '["awd","semislick"]'::jsonb, '/mockups/sport.png'),
          ('Anna Miller', 'Obey', 'Sport GT', 'JTS 349', '445102', 320000, '$ 320,000', 'Sport', 'reserved', '["slick","race_brakes"]'::jsonb, '/mockups/suv.png'),
          ('Larry Dealership', 'Vapid', 'Dominator ASP', 'LRY 001', '555123', 85000, '$ 85,000', 'Muscle', 'sold', '["awd"]'::jsonb, '/mockups/classic.png'),
          ('John Doe', 'Grotti', 'Itali RSX', 'RX 999', '123456', 2500000, '$ 2,500,000', 'Sport', 'available', '["awd","slick","race_brakes"]'::jsonb, '/mockups/sport.png');
      `);
      console.log('✅ Seeded cars');
    }

    // Seed a default auth token for development
    const tokenCount = await client.query('SELECT COUNT(*) FROM auth_tokens');
    if (parseInt(tokenCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO auth_tokens (token, label) VALUES
          ('dev-access-token-2024', 'Development Token');
      `);
      console.log('✅ Seeded default auth token: dev-access-token-2024');
    }
  } finally {
    client.release();
  }
}

export default pool;
