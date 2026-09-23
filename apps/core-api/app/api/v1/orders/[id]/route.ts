import {createHash} from 'node:crypto';
import {clientAddress, errorResponse} from '@nadav/adapters';
import {notFound, publicOrder} from '@nadav/core';
import {assertRestaurant} from '../../../../../server/context';

// Public endpoint: knowing the (random) order id is the only credential, so it only reveals what the customer already
// knows about the purchase and never phone, email, address or notes.
export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const slug = new URL(request.url).searchParams.get('restaurant') ?? '';
    const {id} = await params;
    const {restaurantId, repository} = await assertRestaurant(slug);
    const fingerprint = createHash('sha256').update(`${restaurantId}:${clientAddress(request)}`).digest('hex');
    if (!await repository.rateLimit(`order-lookup:${fingerprint}`, 120, 900)) return Response.json({error: {code: 'RATE_LIMITED', message: 'Demasiados intentos. Esperá unos minutos.'}}, {status: 429});
    const order = await repository.order(restaurantId, id);
    if (!order) throw notFound('Pedido no encontrado.');
    return Response.json({order: publicOrder(order)}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) { return errorResponse(error); }
}
