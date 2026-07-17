require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const pool = require('./db');
const authRoutes = require('./routes/auth');
const kycRoutes  = require('./routes/kyc');
const userRoutes = require('./routes/users');
const syncRoutes  = require('./routes/sync');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();
const PORT = process.env.PORT || 5000;
const BODY_LIMIT_MB = process.env.BODY_LIMIT_MB || 30;
const BODY_LIMIT = `${BODY_LIMIT_MB}mb`;

// ─── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',
    'http://localhost:4173',  // Vite preview
    'http://localhost:5500',  // VS Code Live Server
    'http://127.0.0.1:5500',  // VS Code Live Server loopback
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ─────────────────────────────────────────────
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

// ─── Static: Serve Uploaded Files ────────────────────────────
// Files accessible at: GET /uploads/<filename>
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/kyc',   kycRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sync',  syncRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// ─── Health Check ────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected'
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message
    });
  }
});

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    console.error('Request body too large:', {
      method: req.method,
      path: req.path,
      limit: BODY_LIMIT,
      length: err.length
    });
    return res.status(413).json({
      error: `Request body too large. Maximum size is ${BODY_LIMIT}`
    });
  }
  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 5}MB`
    });
  }
  // Multer file type error
  if (err.message && err.message.includes('Only JPG')) {
    return res.status(400).json({ error: err.message });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║  🚀 Vexaro KYC Backend Running        ║
  ║  Port: ${PORT}                           ║
  ║  Health: http://localhost:${PORT}/api/health ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = app;
