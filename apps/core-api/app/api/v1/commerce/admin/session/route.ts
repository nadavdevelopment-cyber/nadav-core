import {createHash} from 'node:crypto';
import {asObject, authenticateCommerceUser, clearCommerceSessionCookie, clientAddress, commerceStoreBySlug, commerceSessionCookie, createCommerceSession, errorResponse, readJson, rpc} from '@nadav/adapters';
import {CoreError} from '@nadav/core';

export async function POST(request: Request) {
  try {
    const body = asObject(await readJson(request, 12_000));
    const origin = new URL(request.url).origin;
    const secure = new URL(origin).protocol === 'https:';
    if (body.action === 'logout') return Response.json({ok: true}, {headers: {'Set-Cookie': clearCommerceSessionCookie(secure)}});
    const store = await commerceStoreBySlug(String(body.store ?? ''));
    const fingerprint = createHash('sha256').update(`${store.id}:${clientAddress(request)}`).digest('hex');
    if (!await rpc<boolean>('core_rate_check', {p_key: `commerce-login:${fingerprint}`, p_limit: 10, p_window_seconds: 900}))
      throw new CoreError('RATE_LIMITED', 'Demasiados intentos. Esperá unos minutos.', 429);
    const auth = await authenticateCommerceUser(String(body.email ?? ''), String(body.password ?? ''), store.id);
    return Response.json({role: auth.role, store: {slug: store.slug, name: store.name}}, {headers: {'Set-Cookie': commerceSessionCookie(createCommerceSession({sub: auth.userId, restaurantId: store.id, role: auth.role}), secure)}});
  } catch (error) { return errorResponse(error); }
}
