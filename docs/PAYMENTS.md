# Mercado Pago del restaurante

Core incluye únicamente Mercado Pago para cobrar pedidos. No incluye suscripciones ni cobros de NADAV.

## Flujo

1. El administrador inicia OAuth con PKCE.
2. El callback consume el intento una sola vez y cifra access/refresh tokens con AES-256-GCM ligado al `restaurant_id`.
3. Core crea una preferencia desde el total recalculado y persistido del pedido.
4. La referencia externa es `nadav-core:{restaurantId}:{orderId}`.
5. El webhook exige firma, consulta el pago server-to-server y compara merchant, ARS, importe, referencia y preferencia.
6. `core_reconcile_payment` actualiza pago y pedido de forma idempotente.

## Variables

- `MERCADOPAGO_CLIENT_ID`
- `MERCADOPAGO_CLIENT_SECRET`
- `MERCADOPAGO_REDIRECT_URI`
- `MERCADOPAGO_TOKEN_ENCRYPTION_KEY` (32 bytes base64)
- `MERCADOPAGO_WEBHOOK_SECRET`

Generá la clave de cifrado con `openssl rand -base64 32`. Respaldala: perderla obliga a reconectar la cuenta.

## Notas operativas

- `NADAV_CORE_STOREFRONT_URL`: a dónde vuelve el cliente tras pagar (`/?order=<id>&restaurant=<slug>&payment=success|pending|failure`). Core no tiene página de pedido propia; si no se define se usa `APP_ORIGIN`.
- Las notificaciones fuera de orden no degradan un pago aprobado (ver migración 0003).
- Si una notificación no coincide con el pedido (monto, referencia) se audita como `payment.mismatch` y se responde 200 para que Mercado Pago no la reenvíe indefinidamente.
- Una reserva de preferencia que quedó en `creating` por más de 2 minutos (request caído) se libera automáticamente al reintentar.
- Un pedido con `paymentStatus=approved` no puede cancelarse hasta que el pago figure
  `refunded` o `charged_back`. Para un reembolso voluntario, realizar primero el refund
  en Mercado Pago y esperar/reconciliar el webhook antes de cancelar el pedido.
