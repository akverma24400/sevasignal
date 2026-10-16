import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { backendRoot } from './config.js';
import { AppError } from './security.js';
import { publicRoutes } from './routes/public.js';
import { authRoutes } from './routes/auth.js';
import { operatorRoutes } from './routes/operator.js';
export function createApp(db, config) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops || false);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { 'upgrade-insecure-requests': config.mode === 'production' ? [] : null },
      },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || config.origins.includes(origin));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, _res, next) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      const origin = req.get('origin');
      const own = `${req.protocol}://${req.get('host')}`;
      if (origin && !config.origins.includes(origin) && origin !== own)
        throw new AppError(403, 'This origin is not allowed.', 'ORIGIN_REJECTED');
      if (req.method !== 'DELETE' && !req.is('application/json'))
        throw new AppError(415, 'Use application/json for this request.');
    }
    next();
  });
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => config.mode === 'test',
      message: {
        error: { message: 'Too many requests. Please try again shortly.', code: 'RATE_LIMIT' },
      },
    }),
  );
  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok', service: 'sevasignal' });
  });
  app.use('/api', publicRoutes(db, config));
  app.use('/api/auth', authRoutes(db, config));
  app.use('/api/operator', operatorRoutes(db));
  app.use('/api', (_req, _res, next) =>
    next(new AppError(404, 'API route not found.', 'NOT_FOUND')),
  );
  const dist = path.resolve(backendRoot, '../frontend/dist');
  if (existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError)
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message || 'Invalid input.',
          fields: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      });
    if (error instanceof AppError)
      return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    if (error.type === 'entity.parse.failed')
      return res
        .status(400)
        .json({ error: { code: 'INVALID_JSON', message: 'The request body must be valid JSON.' } });
    if (error.type === 'entity.too.large')
      return res
        .status(413)
        .json({ error: { code: 'TOO_LARGE', message: 'The request is too large.' } });
    if (error.code === '23505')
      return res.status(409).json({
        error: { code: 'CONFLICT', message: 'This record already exists. Please refresh.' },
      });
    console.error('Request failed:', error.message);
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' },
    });
  });
  return app;
}
