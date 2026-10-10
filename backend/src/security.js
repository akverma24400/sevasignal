import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [algorithm, salt, value] = String(stored).split(':');
  if (algorithm !== 'scrypt' || !salt || !value) return false;
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(value, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
export const createToken = () => randomBytes(32).toString('hex');
export class AppError extends Error {
  constructor(status, message, code = 'REQUEST_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const cookieName = 'sevasignal_session';
export const cookieOptions = (config) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.mode === 'production',
  path: '/api',
});
export function operatorAuth(db) {
  return async (req, _res, next) => {
    const token = req.cookies[cookieName];
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new AppError(401, 'Please sign in to continue.', 'UNAUTHENTICATED');
    const { rows } = await db.query(
      `SELECT o.id, o.name, o.email, o.centre_id FROM sessions se JOIN operators o ON o.id=se.operator_id WHERE se.token_hash=$1 AND se.expires_at>NOW()`,
      [tokenHash(token)],
    );
    if (!rows[0])
      throw new AppError(401, 'Your session has expired. Please sign in again.', 'UNAUTHENTICATED');
    req.operator = rows[0];
    req.sessionHash = tokenHash(token);
    next();
  };
}
