import {dispatchAutoPrint, fetchMercadoPagoPayment, reconcileMercadoPagoPayment, parsePaymentReference, verifyMercadoPagoSignature} from '@nadav/adapters';
import {CoreError} from '@nadav/core';
import {coreContext} from '../../../../../../server/context';

export async function POST(request: Request) {
  try {
    const dataId = new URL(request.url).searchParams.get('data.id');
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) return Response.json({error: 'Webhook not configured.'}, {status: 503});
    if (!verifyMercadoPagoSignature(request.headers.get('x-signature'), request.headers.get('x-request-id'), dataId, secret)) return Response.json({error: 'Invalid signature.'}, {status: 401});
    if (Number(request.headers.get('content-length') ?? 0) > 4096) return Response.json({error: 'Invalid notification.'}, {status: 400});
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4096) return Response.json({error: 'Invalid notification.'}, {status: 400});
    let body: {type?: string; data?: {id?: string | number}};
    try { body = JSON.parse(raw); } catch { return Response.json({error: 'Invalid notification.'}, {status: 400}); }
    if (String(body.data?.id) !== dataId) return Response.json({error: 'Invalid payment.'}, {status: 400});
    if (body.type !== 'payment') return Response.json({ok: true});
    const context = await coreContext();
    const payment = await fetchMercadoPagoPayment(context.restaurantId, dataId!);
    const reference = parsePaymentReference(payment.external_reference ?? '');
    if (!reference || reference.restaurantId !== context.restaurantId) return Response.json({error: 'Invalid restaurant.'}, {status: 400});
    const order = await context.repository.order(context.restaurantId, reference.orderId);
    if (!order || order.paymentMethod !== 'mercado_pago') return Response.json({error: 'Unknown order.'}, {status: 400});
    try {
      const status = await reconcileMercadoPagoPayment(context.restaurantId, order, payment);
      // Mercado Pago orders are printed once paid.
      if (status === 'approved' && context.config.features.printNode) await dispatchAutoPrint(context.restaurantId, order.id).catch(error => console.error('Auto print failed', error instanceof Error ? error.message : 'unknown'));
    } catch (error) {
      if (!(error instanceof CoreError) || error.code !== 'PAYMENT_MISMATCH') throw error;
      // Retrying cannot fix a mismatch: record it and acknowledge so Mercado Pago stops re-sending it.
      await context.repository.audit({restaurantId: context.restaurantId, action: 'payment.mismatch', details: {orderId: order.id, paymentId: payment.id}}).catch(() => undefined);
      console.error('Mercado Pago payment does not match order', order.id, payment.id);
    }
    return Response.json({ok: true});
  } catch (error) {
    console.error('Mercado Pago webhook rejected', error instanceof Error ? error.message : 'unknown');
    return Response.json({error: 'Payment could not be verified.'}, {status: 503});
  }
}
