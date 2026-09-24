import {asObject, errorResponse, readJson, requireAdmin} from '@nadav/adapters';
import type {OrderStatus} from '@nadav/core';
import {coreContext} from '../../../../../server/context';

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const context = await coreContext();
    const params = new URL(request.url).searchParams;
    const before = params.get('before') ?? undefined;
    const limit = Math.min(Math.max(Math.trunc(Number(params.get('limit'))) || 50, 1), 100);
    const orders = await context.repository.listOrders(context.restaurantId, {limit, before});
    // nextCursor is only meaningful when a full page came back; a shorter page means there's nothing older left.
    const nextCursor = orders.length === limit ? orders[orders.length - 1].createdAt : null;
    return Response.json({orders, nextCursor});
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    requireAdmin(request);
    const body = asObject(await readJson(request, 5000, {adminOnly: true}));
    const context = await coreContext();
    const order = await context.repository.updateOrderStatus(context.restaurantId, String(body.orderId ?? ''), String(body.status ?? '') as OrderStatus);
    await context.repository.audit({restaurantId: context.restaurantId, action: 'order.status_changed', details: {orderId: order.id, status: order.status}});
    return Response.json({order});
  } catch (error) { return errorResponse(error); }
}
