import {errorResponse} from '@nadav/adapters';
import {assertRestaurant} from '../../../../server/context';

export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get('restaurant') ?? '';
    const {restaurantId, config, repository} = await assertRestaurant(slug);
    const catalog = await repository.catalog(restaurantId);
    if (!catalog) return Response.json({error: {code: 'NOT_FOUND', message: 'El catálogo no está disponible.'}}, {status: 404});
    return Response.json({restaurant: {...config.identity, features: config.features}, catalog, ordering: config.ordering, payments: config.payments}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    if (error instanceof Error && error.message === 'RESTAURANT_NOT_FOUND') return Response.json({error: {code: 'NOT_FOUND', message: 'Restaurante no encontrado.'}}, {status: 404});
    return errorResponse(error);
  }
}
