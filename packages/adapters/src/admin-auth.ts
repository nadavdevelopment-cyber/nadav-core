import {createHmac, timingSafeEqual} from 'node:crypto';
import {CoreError} from '@nadav/core';

const cookieName = 'nadav_core_admin';
const duration = 60 * 60 * 12;
function secret() {
  const value = process.env.NADAV_CORE_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('NADAV_CORE_SESSION_SECRET must contain at least 32 characters.');
  return value;
}
function signature(payload: string) { return createHmac('sha256', secret()).update(payload).digest('base64url'); }
export function createAdminSession(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({role: 'owner', exp: Math.floor(now / 1000) + duration})).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
export function verifyAdminSession(value: string | undefined, now = Date.now()) {
  if (!value) return false;
  const [payload, provided, ...extra] = value.split('.');
  if (!payload || !provided || extra.length) return false;
  const wanted = Buffer.from(signature(payload));
  const actual = Buffer.from(provided);
  if (wanted.length !== actual.length || !timingSafeEqual(wanted, actual)) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {role?: string; exp?: number}; return data.role === 'owner' && Number(data.exp) > now / 1000; } catch { return false; }
}
export function verifyAdminToken(value: string) {
  const expected = process.env.NADAV_CORE_ADMIN_TOKEN ?? '';
  const actual = Buffer.from(value);
  const wanted = Buffer.from(expected);
  return expected.length >= 24 && actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
export function sessionCookie(value: string, secure: boolean) {
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${duration}${secure ? '; Secure' : ''}`;
}
export function clearSessionCookie(secure: boolean) { return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`; }
export function adminCookie(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
  return cookie?.slice(cookieName.length + 1);
}
export function requireAdmin(request: Request) {
  if (!verifyAdminSession(adminCookie(request))) throw new CoreError('NO_AUTH', 'Iniciá sesión para continuar.', 401);
}
