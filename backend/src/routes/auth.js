import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import {
  verifyPassword,
  hashPassword,
  createToken,
  tokenHash,
  cookieName,
  cookieOptions,
  AppError,
  operatorAuth,
} from '../security.js';
export function authRoutes(db, config) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.mode === 'test',
    message: {
      error: { message: 'Too many sign-in attempts. Try again in 15 minutes.', code: 'RATE_LIMIT' },
    },
  });
  router.post('/login', limiter, async (req, res) => {
    const input = z
      .object({
        email: z
          .email()
          .max(200)
          .transform((v) => v.toLowerCase()),
        password: z.string().min(1).max(128),
      })
      .parse(req.body);
    const user = (await db.query('SELECT * FROM operators WHERE email=$1', [input.email])).rows[0];
    // Perform scrypt even for missing accounts to reduce account enumeration by timing.
    const fallback = 'scrypt:00000000000000000000000000000000:' + '00'.repeat(64);
    const valid = await verifyPassword(input.password, user?.password_hash || fallback);
    if (!user || !valid)
      throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
    const token = createToken();
    await db.query('DELETE FROM sessions WHERE expires_at<=NOW()');
    await db.query('INSERT INTO sessions(token_hash,operator_id,expires_at) VALUES($1,$2,$3)', [
      tokenHash(token),
      user.id,
      new Date(Date.now() + config.sessionHours * 3600000),
    ]);
    res.cookie(cookieName, token, {
      ...cookieOptions(config),
      maxAge: config.sessionHours * 3600000,
    });
    res.json({
      operator: { id: user.id, name: user.name, email: user.email, centre_id: user.centre_id },
    });
  });
  router.get('/me', operatorAuth(db), (req, res) => res.json({ operator: req.operator }));
  router.post('/logout', async (req, res) => {
    const token = req.cookies[cookieName];
    if (token) await db.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(token)]);
    res.clearCookie(cookieName, cookieOptions(config));
    res.status(204).end();
  });
  router.post('/password', operatorAuth(db), async (req, res) => {
    const input = z
      .object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(12).max(128),
      })
      .parse(req.body);
    const user = (
      await db.query('SELECT password_hash FROM operators WHERE id=$1', [req.operator.id])
    ).rows[0];
    if (!(await verifyPassword(input.currentPassword, user.password_hash)))
      throw new AppError(400, 'Current password is incorrect.');
    const hash = await hashPassword(input.newPassword);
    await db.transaction(async (tx) => {
      await tx.query('UPDATE operators SET password_hash=$1 WHERE id=$2', [hash, req.operator.id]);
      await tx.query('DELETE FROM sessions WHERE operator_id=$1 AND token_hash<>$2', [
        req.operator.id,
        req.sessionHash,
      ]);
    });
    res.json({ message: 'Password updated. Other sessions have been signed out.' });
  });
  return router;
}
