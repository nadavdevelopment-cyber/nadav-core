import {asObject, errorResponse, readJson} from '@nadav/adapters';
import {quoteCheckout, type CheckoutInput} from '@nadav/core';
import {assertRestaurant} from '../../../../server/context';

export async function POST(request: Request) {
  try {
    const body = asObject(await readJson(request, 30_000));
    const {restaurantId, config, repository} = await assertRestaurant(String(body.restaurant ?? ''));
    const catalog = await repository.catalog(restaurantId);
    if (!catalog) throw new Error('Catalog not configured.');
    return Response.json({quote: quoteCheckout(config, catalog, body.checkout as CheckoutInput)});
  } catch (error) { return errorResponse(error); }
}
