import {timingSafeEqual} from 'node:crypto';
import {CoreError} from '@nadav/core';
import {cookieHeader, decodeSession, encodeSession, readCookie} from './session.ts';

const cookieName = 'nadav_core_admin';
const duration = 60 * 60 * 12;

export function createAdminSession(now = Date.now()) {
  return encodeSession({role: 'owner', exp: Math.floor(now / 1000) + duration});
}
export function verifyAdminSession(value: string | undefined, now = Date.now()) {
  const data = decodeSession<{role?: string; exp?: number}>(value);
  return Boolean(data && data.role === 'owner' && Number(data.exp) > now / 1000);
}
export function verifyAdminToken(value: string) {
  const expected = process.env.NADAV_CORE_ADMIN_TOKEN ?? '';
  const actual = Buffer.from(value);
  const wanted = Buffer.from(expected);
  return expected.length >= 24 && actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
export function sessionCookie(value: string, secure: boolean) {
  return cookieHeader(cookieName, value, {maxAge: duration, secure, sameSite: 'Lax'});
}
export function clearSessionCookie(secure: boolean) { return cookieHeader(cookieName, '', {maxAge: 0, secure, sameSite: 'Lax'}); }
export function adminCookie(request: Request) { return readCookie(request, cookieName); }
export function requireAdmin(request: Request) {
  if (!verifyAdminSession(adminCookie(request))) throw new CoreError('NO_AUTH', 'Iniciá sesión para continuar.', 401);
}
