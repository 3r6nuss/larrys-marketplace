import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { migrate, seed } from './db.js';
import db from './db.js';
import { getImageStorageDriver } from './lib/image-storage.js';

// Routes
import authRoutes from './routes/auth.js';
import listingsRoutes from './routes/listings.js';
import ticketsRoutes from './routes/tickets.js';
import usersRoutes from './routes/users.js';
import vaultRoutes from './routes/vault.js';
import catalogRoutes from './routes/catalog.js';
import logsRoutes from './routes/logs.js';
import statsRoutes from './routes/stats.js';
import reviewsRoutes from './routes/reviews.js';
import requestsRoutes from './routes/requests.js';
import backupRoutes from './routes/backup.js';
import './discord-bot.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3002');
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction || process.env.TRUST_PROXY_HOPS) {
  const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '1', 10);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 1) {
    throw new Error('TRUST_PROXY_HOPS must be a positive integer.');
  }
  app.set('trust proxy', trustProxyHops);
}
app.disable('x-powered-by');

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
  });
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'larrys',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.get('/api/ready', async (req, res) => {
  try {
    await db.query('SELECT 1 AS healthy');
    res.json({ status: 'ready', database: db.pool ? 'postgresql' : 'sqlite' });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', database: 'down', error: error.message });
  }
});

// Build session store — PostgreSQL or SQLite
async function buildSessionStore() {
  if (db.pool) {
    // PostgreSQL
    const connectPgSimple = (await import('connect-pg-simple')).default;
    const PgSession = connectPgSimple(session);
    return new PgSession({
      pool: db.pool,
      tableName: 'session',
      createTableIfMissing: true,
    });
  } else {
    // SQLite
    const SqliteSessionStore = (await import('./middleware/SqliteSessionStore.js')).default;
    return new SqliteSessionStore(db);
  }
}

async function setupAndStart() {
  try {
    const imageStorageDriver = getImageStorageDriver();
    if (process.env.HA_MODE === 'true' && (!db.pool || imageStorageDriver !== 's3')) {
      throw new Error('HA_MODE requires PostgreSQL and IMAGE_STORAGE=s3.');
    }
    const sessionSecret = process.env.SESSION_SECRET || (isProduction ? '' : 'larrys-dev-secret-change-me');
    if (isProduction && sessionSecret.length < 32) {
      throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
    }

    await migrate();
    await seed();

    const store = await buildSessionStore();

    // Session middleware
    app.use(session({
      store,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: 'larrys.sid',
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.COOKIE_SECURE
          ? process.env.COOKIE_SECURE === 'true'
          : isProduction,
        sameSite: 'lax',
      },
    }));

    // Serve uploaded images
    app.use('/uploads', express.static(uploadsDir, {
      immutable: true,
      maxAge: '1y',
    }));

    // Routes
    app.use('/api/auth', authRoutes);

    // ── Dev-Login (nur lokal) ──
    // Die Route liegt in einer per .gitignore ausgeschlossenen Datei und wird
    // ausschließlich geladen, wenn diese lokal vorhanden ist. Dadurch kann der
    // passwortlose Superadmin-Bypass niemals auf den Server / in Produktion gelangen.
    const devLoginFile = fileURLToPath(new URL('./routes/dev-login.js', import.meta.url));
    if (fs.existsSync(devLoginFile)) {
      const { default: devLoginRoutes } = await import('./routes/dev-login.js');
      app.use('/api/auth', devLoginRoutes);
      console.log('🛠️  Dev-Login aktiv (lokal, nicht im Repo)');
    }

    app.use('/api/listings', listingsRoutes);
    app.use('/api/tickets', ticketsRoutes);
    app.use('/api/users', usersRoutes);
    app.use('/api/vault', vaultRoutes);
    app.use('/api/catalog', catalogRoutes);
    app.use('/api/logs', logsRoutes);
    app.use('/api/stats', statsRoutes);
    app.use('/api/reviews', reviewsRoutes);
    app.use('/api/requests', requestsRoutes);
    app.use('/api/backup', backupRoutes);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚗 Larry's API running on http://localhost:${PORT}`);
      console.log(`📁 Uploads directory: ${uploadsDir}`);
      console.log(`🔐 Discord OAuth: ${process.env.DISCORD_CLIENT_ID ? 'configured' : 'DEV MODE (no Discord)'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

setupAndStart();
