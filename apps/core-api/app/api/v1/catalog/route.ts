import {errorResponse} from '@nadav/adapters';
import {notFound} from '@nadav/core';
import {assertRestaurant} from '../../../../server/context';

export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get('restaurant') ?? '';
    const {restaurantId, config, repository} = await assertRestaurant(slug);
    const catalog = await repository.catalog(restaurantId);
    if (!catalog) throw notFound('El catálogo no está disponible.');
    return Response.json({restaurant: {...config.identity, features: config.features}, catalog, ordering: config.ordering, payments: config.payments}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) { return errorResponse(error); }
}
