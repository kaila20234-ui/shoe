import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env.js';
import routes from './routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import ApiError from './utils/ApiError.js';

function authRateLimit({ windowMs = 15 * 60 * 1000, max = 100 } = {}) {
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
        error: { code: 'CONFLICT', message: 'Too many authentication requests; try again later' },
      });
    }

    current.count += 1;
    return next();
  };
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(morgan('dev'));
app.use('/api/auth', authRateLimit());
app.use('/api/payments/paystack/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', routes);
app.use((req, res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found')));
app.use(errorHandler);

export default app;
