import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { migrate, seed } from './db.js';
import authRoutes from './routes/auth.js';
import carRoutes from './routes/cars.js';
import employeeRoutes from './routes/employees.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/employees', employeeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function start() {
  try {
    await migrate();
    await seed();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚗 Larry's API running on http://localhost:${PORT}`);
      console.log(`📁 Uploads directory: ${uploadsDir}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
