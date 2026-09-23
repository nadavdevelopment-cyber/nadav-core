# NADAV Core — salida a clientes

Este documento acompaña `NADAV_SECURITY_CHECKLIST.md`. El código puede estar listo,
pero una venta real también depende de infraestructura y proveedores externos.

## Qué deja resuelto este patch

- Commerce no recotiza un retry válido antes de recuperar el pedido original.
- Reutilizar una `Idempotency-Key` con otro checkout devuelve conflicto.
- El mismo control existe también dentro de PostgreSQL para cubrir carreras concurrentes.
- Se retira el pago con tarjeta de demostración del storefront y el servidor lo rechaza.
- Transferencia pasa a ser el medio de pago operativo de Commerce.
- Un admin puede confirmar una transferencia recibida y registrar un reembolso realizado.
- `revenue`/`Cobrado` cuenta únicamente pedidos con pago `approved` y no cancelados.
- Login Commerce tiene rate limit.
- Revocar o degradar un miembro Commerce toma efecto en la siguiente request admin.
- Pedidos ya cobrados no pueden cancelarse hasta registrar/reconciliar el reembolso.
- PrintNode puede reintentar jobs failed/trabados con tope de intentos y endpoint de mantenimiento.
- Vera conserva la misma idempotency key cuando una creación se reintenta.
- El resumen de checkout usa el delivery fee real del catálogo, no un valor hardcodeado.
- CI/build de raíz también construye BurgerHouse y Vera Studio.
- El admin de Vera puede subir imágenes JPG/PNG/WebP al bucket del tenant y el storefront acepta esas imágenes remotas.
- Vera agrega headers de seguridad y restringe imágenes remotas al bucket público de NADAV Core.

## Antes de vender el primer Commerce

1. Aplicar `0004_commerce_sale_ready.sql` al Supabase objetivo.
2. Ejecutar `npm run typecheck`, `npm test`, `npm run test:sql` y `npm run build`.
3. Confirmar `NADAV_CORE_DEMO_MODE=false` en Vercel Production.
4. Revisar `APP_ORIGIN` y `NADAV_CORE_ALLOWED_ORIGINS` con dominios exactos.
5. Configurar backups y realizar al menos un restore rehearsal.
6. Confirmar MFA y mínimo privilegio en GitHub, Vercel y Supabase.
7. Ejecutar un secret scan del historial (`gitleaks` o equivalente).
8. Confirmar observabilidad/alertas para 5xx y pedidos fallidos.

## Food / Mercado Pago

Si un cliente usa Mercado Pago:

1. Definir `NADAV_CORE_STOREFRONT_URL`.
2. Probar OAuth y un pago sandbox de punta a punta.
3. Confirmar webhook `approved`.
4. Probar un estado no aprobado.
5. Verificar refund/chargeback de forma controlada.
6. No habilitar dinero real hasta completar esa prueba.

## PrintNode

Si el cliente compra autoimpresión:

1. Probar físicamente el modelo de impresora y papel 58/80 mm.
2. Probar reimpresión manual.
3. Configurar `CRON_SECRET` y un scheduler para `/api/v1/maintenance` (idealmente cada 1–5 minutos si el plan lo permite).
4. Monitorear jobs `failed` y mantener `retry_failed`/reimpresión manual como fallback operativo.

## Límites que no deben venderse como funciones existentes

- Commerce no procesa tarjetas todavía. El tipo `card` queda reservado para una integración futura, pero API y UI productivas lo rechazan.
- NADAV no inicia automáticamente refunds de Mercado Pago: el refund se ejecuta en Mercado Pago y Core bloquea la cancelación mientras el pago siga `approved`.
- Esta checklist no sustituye revisión legal, política de privacidad ni cumplimiento aplicable.

Cuando estos puntos externos estén verificados, ejecutar de nuevo
`docs/NADAV_SECURITY_CHECKLIST.md` sobre el commit exacto que se desplegará.
