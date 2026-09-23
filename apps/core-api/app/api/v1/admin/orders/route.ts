import {asObject, errorResponse, readJson, requireAdmin} from '@nadav/adapters';
import type {OrderStatus} from '@nadav/core';
import {coreContext} from '../../../../../server/context';

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const context = await coreContext();
    return Response.json({orders: await context.repository.listOrders(context.restaurantId)});
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
