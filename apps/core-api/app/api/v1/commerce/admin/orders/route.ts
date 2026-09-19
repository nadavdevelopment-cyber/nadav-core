import {asObject, commerceListOrders, commerceStoreBySlug, commerceUpdateOrder, errorResponse, readJson, requireCommerceAdmin} from '@nadav/adapters';
import type {CommerceOrderStatus} from '@nadav/core';

export async function GET(request: Request) {
  try { const store = await commerceStoreBySlug(new URL(request.url).searchParams.get('store') ?? ''); requireCommerceAdmin(request, store.id); return Response.json({orders: await commerceListOrders(store.id)}); } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try { const body = asObject(await readJson(request)); const store = await commerceStoreBySlug(String(body.store ?? '')); const session = requireCommerceAdmin(request, store.id, 'editor'); const order = await commerceUpdateOrder(store.id, String(body.orderId ?? ''), String(body.status ?? '') as CommerceOrderStatus); return Response.json({order, actor: session.sub}); } catch (error) { return errorResponse(error); }
}
