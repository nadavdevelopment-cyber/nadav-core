import {asObject, commerceListOrders, commerceStoreBySlug, commerceUpdateOrder, commerceUpdatePaymentStatus, errorResponse, readJson, requireCommerceAdmin} from '@nadav/adapters';
import {CoreError, type CommerceOrderStatus, type CommercePaymentStatus} from '@nadav/core';

export async function GET(request: Request) {
  try { const store = await commerceStoreBySlug(new URL(request.url).searchParams.get('store') ?? ''); await requireCommerceAdmin(request, store.id); return Response.json({orders: await commerceListOrders(store.id)}); } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    const body = asObject(await readJson(request));
    const store = await commerceStoreBySlug(String(body.store ?? ''));
    const hasOrderStatus = typeof body.status === 'string' && body.status.length > 0;
    const hasPaymentStatus = typeof body.paymentStatus === 'string' && body.paymentStatus.length > 0;
    if (hasOrderStatus === hasPaymentStatus) throw new CoreError('INVALID_INPUT', 'Indicá un solo cambio por vez.', 400);
    if (hasPaymentStatus) {
      const session = await requireCommerceAdmin(request, store.id, 'admin');
      const order = await commerceUpdatePaymentStatus(store.id, String(body.orderId ?? ''), String(body.paymentStatus) as CommercePaymentStatus);
      return Response.json({order, actor: session.sub});
    }
    const session = await requireCommerceAdmin(request, store.id, 'editor');
    const order = await commerceUpdateOrder(store.id, String(body.orderId ?? ''), String(body.status) as CommerceOrderStatus);
    return Response.json({order, actor: session.sub});
  } catch (error) { return errorResponse(error); }
}
