import {CoreError, isUuid, type CommerceRole} from '@nadav/core';
import {commerceMemberRole} from './commerce.ts';
import {cookieHeader, decodeSession, encodeSession, readCookie} from './session.ts';

const cookieName = 'nadav_commerce_admin';
const duration = 60 * 60 * 12;
const roleRank: Record<CommerceRole, number> = {owner: 3, admin: 2, editor: 1};
type CommerceSession = {sub: string; restaurantId: string; role: CommerceRole; exp: number};

// The Commerce admin runs on the storefront's domain and calls Core cross-site, so in HTTPS the cookie must be SameSite=None.
const sameSite = (secure: boolean) => secure ? 'None' as const : 'Lax' as const;

export function createCommerceSession(session: Omit<CommerceSession, 'exp'>) { return encodeSession({...session, exp: Math.floor(Date.now() / 1000) + duration}); }
export function commerceSessionCookie(value: string, secure: boolean) { return cookieHeader(cookieName, value, {maxAge: duration, secure, sameSite: sameSite(secure)}); }
export function clearCommerceSessionCookie(secure: boolean) { return cookieHeader(cookieName, '', {maxAge: 0, secure, sameSite: sameSite(secure)}); }
export function verifyCommerceSession(value: string | undefined): CommerceSession | null {
  const parsed = decodeSession<CommerceSession>(value);
  return parsed && isUuid(parsed.sub) && isUuid(parsed.restaurantId) && Object.hasOwn(roleRank, parsed.role) && parsed.exp > Date.now() / 1000 ? parsed : null;
}
export async function requireCommerceAdmin(request: Request, restaurantId: string, required: CommerceRole = 'editor') {
  const session = verifyCommerceSession(readCookie(request, cookieName));
  if (!session || session.restaurantId !== restaurantId) throw new CoreError('NO_AUTH', 'No tenés permisos para esta acción.', 401);
  // The role inside the cookie is only a snapshot. Re-read membership on every admin request so
  // revocation/demotion takes effect immediately instead of remaining valid for the cookie lifetime.
  const role = await commerceMemberRole(restaurantId, session.sub);
  if (!role || roleRank[role] < roleRank[required]) throw new CoreError('NO_AUTH', 'No tenés permisos para esta acción.', 401);
  return {...session, role};
}

export async function authenticateCommerceUser(email: string, password: string, restaurantId: string) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ''); const anon = process.env.SUPABASE_ANON_KEY;
  if (!base || !anon) throw new CoreError('MISCONFIGURED', 'Supabase Auth no está configurado.', 503);
  if (!email || !password || email.length > 254 || password.length > 200) throw new CoreError('NO_AUTH', 'Credenciales inválidas.', 401);
  const response = await fetch(`${base}/auth/v1/token?grant_type=password`, {method: 'POST', headers: {apikey: anon, 'Content-Type': 'application/json'}, body: JSON.stringify({email, password}), cache: 'no-store', signal: AbortSignal.timeout(10_000)});
  if (!response.ok) throw new CoreError('NO_AUTH', 'Credenciales inválidas.', 401);
  const data = await response.json() as {user?: {id?: string}};
  const userId = data.user?.id ?? '';
  const role = await commerceMemberRole(restaurantId, userId);
  if (!role) throw new CoreError('NO_AUTH', 'Tu usuario no tiene acceso a este negocio.', 403);
  return {userId, role};
}
