import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { migrate, seed } from './db.js';
import db from './db.js';

// Routes
import authRoutes from './routes/auth.js';
import listingsRoutes from './routes/listings.js';
import ticketsRoutes from './routes/tickets.js';
import usersRoutes from './routes/users.js';
import vaultRoutes from './routes/vault.js';
import catalogRoutes from './routes/catalog.js';
import logsRoutes from './routes/logs.js';
import statsRoutes from './routes/stats.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3002');

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
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

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
    await migrate();
    await seed();

    const store = await buildSessionStore();

    // Session middleware
    app.use(session({
      store,
      secret: process.env.SESSION_SECRET || 'larrys-dev-secret-change-me',
      resave: false,
      saveUninitialized: false,
      name: 'larrys.sid',
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: 'lax',
      },
    }));

    // Serve uploaded images
    app.use('/uploads', express.static(uploadsDir));

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/listings', listingsRoutes);
    app.use('/api/tickets', ticketsRoutes);
    app.use('/api/users', usersRoutes);
    app.use('/api/vault', vaultRoutes);
    app.use('/api/catalog', catalogRoutes);
    app.use('/api/logs', logsRoutes);
    app.use('/api/stats', statsRoutes);

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

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
