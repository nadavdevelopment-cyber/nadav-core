import {createHmac, timingSafeEqual} from 'node:crypto';

/** Shared plumbing for the HMAC-signed session cookies (dedicated admin and Commerce admin). */
export function sessionSecret() {
  const value = process.env.NADAV_CORE_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('NADAV_CORE_SESSION_SECRET must contain at least 32 characters.');
  return value;
}

const sign = (payload: string) => createHmac('sha256', sessionSecret()).update(payload).digest('base64url');

export function encodeSession(data: object) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Returns the parsed payload only when the signature is valid. Callers must still validate the shape and `exp`. */
export function decodeSession<T>(value: string | undefined): T | null {
  if (!value) return null;
  const [payload, provided, ...extra] = value.split('.');
  if (!payload || !provided || extra.length) return null;
  const wanted = Buffer.from(sign(payload));
  const actual = Buffer.from(provided);
  if (wanted.length !== actual.length || !timingSafeEqual(wanted, actual)) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()) as T; } catch { return null; }
}

export function readCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return cookie?.slice(name.length + 1);
}

export function cookieHeader(name: string, value: string, options: {maxAge: number; secure: boolean; sameSite: 'Lax' | 'None'}) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=${options.sameSite}; Max-Age=${options.maxAge}${options.secure ? '; Secure' : ''}`;
}
