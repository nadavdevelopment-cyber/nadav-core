import {createHash} from 'node:crypto';
import {after} from 'next/server';
import {asObject, dispatchPrintJob, ensurePaymentPreference, errorResponse, readJson, supabase} from '@nadav/adapters';
import {isRestaurantOpen, quoteCheckout, type CheckoutInput} from '@nadav/core';
import {assertRestaurant} from '../../../../server/context';

export async function POST(request: Request) {
  try {
    const body = asObject(await readJson(request, 40_000));
    const context = await assertRestaurant(String(body.restaurant ?? ''));
    if (!isRestaurantOpen(context.config)) return Response.json({error: {code: 'RESTAURANT_CLOSED', message: 'El restaurante está cerrado en este momento.'}}, {status: 409});
    const key = request.headers.get('idempotency-key') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(key)) return Response.json({error: {code: 'INVALID_IDEMPOTENCY_KEY', message: 'Falta una clave de idempotencia válida.'}}, {status: 400});
    const fingerprint = createHash('sha256').update(`${context.restaurantId}:${request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'}`).digest('hex');
    if (!await context.repository.rateLimit(`order:${fingerprint}`, 30, 900)) return Response.json({error: {code: 'RATE_LIMITED', message: 'Demasiados intentos. Esperá unos minutos.'}}, {status: 429});
    const catalog = await context.repository.catalog(context.restaurantId);
    if (!catalog) throw new Error('Catalog not configured.');
    const checkout = body.checkout as CheckoutInput;
    const quote = quoteCheckout(context.config, catalog, checkout);
    const {order, created} = await context.repository.placeOrder({restaurantId: context.restaurantId, idempotencyKey: key, input: checkout, quote});
    if (order.paymentMethod !== checkout.paymentMethod) return Response.json({error: {code: 'IDEMPOTENCY_CONFLICT', message: 'La clave ya se usó para otro pedido.'}}, {status: 409});
    let paymentUrl: string | undefined;
    if (order.paymentMethod === 'mercado_pago' && !context.demo) paymentUrl = await ensurePaymentPreference(order, context.config.identity.slug);
    if (!context.demo && context.config.features.printNode && created) after(async () => {
      const jobs = await supabase<{id: string}[]>(`core_print_jobs?restaurant_id=eq.${context.restaurantId}&order_id=eq.${order.id}&kind=eq.auto&status=eq.pending&select=id`);
      if (jobs[0]) await dispatchPrintJob(jobs[0].id);
    });
    return Response.json({order, paymentUrl}, {status: created ? 201 : 200});
  } catch (error) { return errorResponse(error); }
}
