import {createHmac, timingSafeEqual} from 'node:crypto';
import {CoreError, type CommerceRole} from '@nadav/core';
import {commerceMemberRole} from './commerce.ts';

const cookieName = 'nadav_commerce_admin';
const duration = 60 * 60 * 12;
type CommerceSession = {sub: string; restaurantId: string; role: CommerceRole; exp: number};
function secret() { const value = process.env.NADAV_CORE_SESSION_SECRET; if (!value || value.length < 32) throw new Error('NADAV_CORE_SESSION_SECRET must contain at least 32 characters.'); return value; }
function signature(payload: string) { return createHmac('sha256', secret()).update(payload).digest('base64url'); }
function cookie(request: Request) { return request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1); }
function allowed(role: CommerceRole, required: CommerceRole) { return ({owner: 3, admin: 2, editor: 1}[role] >= {owner: 3, admin: 2, editor: 1}[required]); }

export function createCommerceSession(session: Omit<CommerceSession, 'exp'>) { const payload = Buffer.from(JSON.stringify({...session, exp: Math.floor(Date.now() / 1000) + duration})).toString('base64url'); return `${payload}.${signature(payload)}`; }
export function commerceSessionCookie(value: string, secure: boolean) { return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=${secure ? 'None' : 'Lax'}; Max-Age=${duration}${secure ? '; Secure' : ''}`; }
export function clearCommerceSessionCookie(secure: boolean) { return `${cookieName}=; Path=/; HttpOnly; SameSite=${secure ? 'None' : 'Lax'}; Max-Age=0${secure ? '; Secure' : ''}`; }
export function verifyCommerceSession(value: string | undefined): CommerceSession | null {
  if (!value) return null;
  const [payload, provided, ...extra] = value.split('.');
  if (!payload || !provided || extra.length) return null;
  const wanted = Buffer.from(signature(payload)); const actual = Buffer.from(provided);
  if (wanted.length !== actual.length || !timingSafeEqual(wanted, actual)) return null;
  try { const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as CommerceSession; return /^[0-9a-f-]{36}$/i.test(parsed.sub) && /^[0-9a-f-]{36}$/i.test(parsed.restaurantId) && ['owner','admin','editor'].includes(parsed.role) && parsed.exp > Date.now() / 1000 ? parsed : null; } catch { return null; }
}
export function requireCommerceAdmin(request: Request, restaurantId: string, required: CommerceRole = 'editor') {
  const session = verifyCommerceSession(cookie(request));
  if (!session || session.restaurantId !== restaurantId || !allowed(session.role, required)) throw new CoreError('NO_AUTH', 'No tenés permisos para esta acción.', 401);
  return session;
}

export async function authenticateCommerceUser(email: string, password: string, restaurantId: string) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ''); const anon = process.env.SUPABASE_ANON_KEY;
  if (!base || !anon) throw new CoreError('MISCONFIGURED', 'Supabase Auth no está configurado.', 503);
  const response = await fetch(`${base}/auth/v1/token?grant_type=password`, {method: 'POST', headers: {apikey: anon, 'Content-Type': 'application/json'}, body: JSON.stringify({email, password}), cache: 'no-store'});
  if (!response.ok) throw new CoreError('NO_AUTH', 'Credenciales inválidas.', 401);
  const data = await response.json() as {user?: {id?: string}};
  const userId = data.user?.id ?? '';
  const role = await commerceMemberRole(restaurantId, userId);
  if (!role) throw new CoreError('NO_AUTH', 'Tu usuario no tiene acceso a este negocio.', 403);
  return {userId, role};
}
