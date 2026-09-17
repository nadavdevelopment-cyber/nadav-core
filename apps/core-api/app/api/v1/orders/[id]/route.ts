import {errorResponse} from '@nadav/adapters';
import {assertRestaurant} from '../../../../../server/context';

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const slug = new URL(request.url).searchParams.get('restaurant') ?? '';
    const {id} = await params;
    const {restaurantId, repository} = await assertRestaurant(slug);
    const order = await repository.order(restaurantId, id);
    return order ? Response.json({order}) : Response.json({error: {code: 'NOT_FOUND', message: 'Pedido no encontrado.'}}, {status: 404});
  } catch (error) { return errorResponse(error); }
}
