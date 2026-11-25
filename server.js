import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRouter from './server/routes/chat.js';
import imageRouter from './server/routes/image.js';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configure trusted proxy (disabled by default to prevent IP spoofing; enable via TRUST_PROXY=true if behind a reverse proxy)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
} else {
  app.set('trust proxy', false);
}

// CORS Configuration: restrict to CORS_ORIGIN in production if specified
const corsOptions = {};
if (process.env.CORS_ORIGIN) {
  const allowedOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
  corsOptions.origin = (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    }
  };
}
app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// API Routes
app.use('/api/chat', chatRouter);
app.use('/api/image', imageRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback: return index.html for unknown GET requests
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected internal server error occurred.'
  });
});

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  🚀 NexoAI Chatbot Server is running!`);
  console.log(`  🔗 Local:   http://localhost:${PORT}`);
  console.log(`  🤖 Model:   ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}`);
  console.log(`  🔑 API Key: ${process.env.GEMINI_API_KEY ? 'Configured (Env)' : 'Not Set in .env'}`);
  console.log(`===============================================`);
});

// Handle server listen errors (e.g. port already in use)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use.`);
    console.error(`👉 Solutions:`);
    console.error(`   1. A previous instance of the server is still running. Stop it or restart your terminal.`);
    console.error(`   2. Or specify a different port in your .env file, e.g.: PORT=3001\n`);
  } else {
    console.error('Server listen error:', err);
  }
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => console.log('HTTP server closed'));
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => console.log('HTTP server closed'));
});
