import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { uploadsDirectory } from './config/uploads.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes.js';

function requestRateLimit({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests; try again later' } = {}) {
  const requests = new Map();
  let nextCleanup = Date.now() + windowMs;
  return (req, res, next) => {
    const now = Date.now();
    if (now >= nextCleanup) {
      for (const [ip, entry] of requests) {
        if (entry.resetAt <= now) requests.delete(ip);
      }
      nextCleanup = now + windowMs;
    }
    const key = req.ip;
    const current = requests.get(key);
    if (!current || current.resetAt <= now) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({
        success: false,
        error: { code: 'CONFLICT', message },
      });
    }

    current.count += 1;
    return next();
  };
}

const app = express();
const complaintRateLimit = requestRateLimit({
  max: 10,
  message: 'Too many complaint messages; try again later',
});
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
      workerSrc: ["'self'", 'blob:'],
    },
  },
}));
app.use((req, res, next) => {
  const allowedOrigins = new Set([
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  const origin = req.get('origin');
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-paystack-signature, x-complaint-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});
app.use(morgan('dev'));
app.use('/api/auth', requestRateLimit());
app.use('/api/complaints', (req, res, next) => {
  if (req.method !== 'POST') return next();
  return complaintRateLimit(req, res, next);
});
app.use('/api/payments/paystack/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDirectory, {
  dotfiles: 'deny',
  index: false,
  immutable: true,
  maxAge: '1y',
}));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

export default app;
