import {createHash} from 'node:crypto';
import {asObject, clientAddress, errorResponse, readJson} from '@nadav/adapters';
import {quoteCheckout, type CheckoutInput} from '@nadav/core';
import {assertRestaurant} from '../../../../server/context';

export async function POST(request: Request) {
  try {
    const body = asObject(await readJson(request, 30_000));
    const {restaurantId, config, repository} = await assertRestaurant(String(body.restaurant ?? ''));
    const fingerprint = createHash('sha256').update(`${restaurantId}:${clientAddress(request)}`).digest('hex');
    if (!await repository.rateLimit(`quote:${fingerprint}`, 120, 900)) return Response.json({error: {code: 'RATE_LIMITED', message: 'Demasiados intentos. Esperá unos minutos.'}}, {status: 429});
    const catalog = await repository.catalog(restaurantId);
    if (!catalog) throw new Error('Catalog not configured.');
    return Response.json({quote: quoteCheckout(config, catalog, body.checkout as CheckoutInput)});
  } catch (error) { return errorResponse(error); }
}
