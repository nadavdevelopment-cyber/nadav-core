import {createHash} from 'node:crypto';
import {after} from 'next/server';
import {asObject, clientAddress, dispatchAutoPrint, ensurePaymentPreference, errorResponse, readJson} from '@nadav/adapters';
import {isRestaurantOpen, isUuid, quoteCheckout, sameCheckout, type CheckoutInput} from '@nadav/core';
import {assertRestaurant} from '../../../../server/context';

const conflict = () => Response.json({error: {code: 'IDEMPOTENCY_CONFLICT', message: 'La clave ya se usó para otro pedido.'}}, {status: 409});

export async function POST(request: Request) {
  try {
    const body = asObject(await readJson(request, 40_000));
    const context = await assertRestaurant(String(body.restaurant ?? ''));
    const key = request.headers.get('idempotency-key') ?? '';
    if (!isUuid(key)) return Response.json({error: {code: 'INVALID_IDEMPOTENCY_KEY', message: 'Falta una clave de idempotencia válida.'}}, {status: 400});
    const fingerprint = createHash('sha256').update(`${context.restaurantId}:${clientAddress(request)}`).digest('hex');
    if (!await context.repository.rateLimit(`order:${fingerprint}`, 30, 900)) return Response.json({error: {code: 'RATE_LIMITED', message: 'Demasiados intentos. Esperá unos minutos.'}}, {status: 429});
    const checkout = body.checkout as CheckoutInput;

    // A retry of an order that was already accepted must return that order, even if the restaurant has closed,
    // stock ran out or prices changed since: those checks only apply to *new* orders.
    let order = await context.repository.orderByIdempotencyKey(context.restaurantId, key);
    let created = false;
    if (order) {
      if (!sameCheckout(order, checkout)) return conflict();
    } else {
      if (!isRestaurantOpen(context.config)) return Response.json({error: {code: 'RESTAURANT_CLOSED', message: 'El restaurante está cerrado en este momento.'}}, {status: 409});
      const catalog = await context.repository.catalog(context.restaurantId);
      if (!catalog) throw new Error('Catalog not configured.');
      const quote = quoteCheckout(context.config, catalog, checkout);
      ({order, created} = await context.repository.placeOrder({restaurantId: context.restaurantId, idempotencyKey: key, input: checkout, quote}));
      if (!created && !sameCheckout(order, checkout)) return conflict(); // another request with the same key won the race
    }

    let paymentUrl: string | undefined;
    if (order.paymentMethod === 'mercado_pago' && order.paymentStatus === 'pending' && !context.demo) paymentUrl = await ensurePaymentPreference(order, context.config.identity.slug);
    // Mercado Pago orders are queued for printing only once paid (see migration 0003), so this is a no-op for them here.
    if (!context.demo && context.config.features.printNode && created) {
      const {restaurantId} = context;
      const orderId = order.id;
      after(() => dispatchAutoPrint(restaurantId, orderId).catch(error => console.error('Auto print failed', error instanceof Error ? error.message : 'unknown')));
    }
    return Response.json({order, paymentUrl}, {status: created ? 201 : 200});
  } catch (error) { return errorResponse(error); }
}
