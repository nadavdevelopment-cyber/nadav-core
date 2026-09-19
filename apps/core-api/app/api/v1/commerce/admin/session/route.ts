import {asObject, authenticateCommerceUser, clearCommerceSessionCookie, commerceStoreBySlug, commerceSessionCookie, createCommerceSession, errorResponse, readJson} from '@nadav/adapters';

export async function POST(request: Request) {
  try {
    const body = asObject(await readJson(request, 12_000));
    const origin = new URL(request.url).origin;
    const secure = new URL(origin).protocol === 'https:';
    if (body.action === 'logout') return Response.json({ok: true}, {headers: {'Set-Cookie': clearCommerceSessionCookie(secure)}});
    const store = await commerceStoreBySlug(String(body.store ?? ''));
    const auth = await authenticateCommerceUser(String(body.email ?? ''), String(body.password ?? ''), store.id);
    return Response.json({role: auth.role, store: {slug: store.slug, name: store.name}}, {headers: {'Set-Cookie': commerceSessionCookie(createCommerceSession({sub: auth.userId, restaurantId: store.id, role: auth.role}), secure)}});
  } catch (error) { return errorResponse(error); }
}
