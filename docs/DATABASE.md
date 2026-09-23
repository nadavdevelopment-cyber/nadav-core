# Base de datos

## Archivos

- `supabase/migrations/0001_core_schema.sql`: esquema e infraestructura, sin datos comerciales.
- `supabase/seed/0001_demo_restaurant.sql`: seed opcional y descartable.

## Modelo

`core_restaurants` guarda configuración tipada; `core_catalog_state` concentra el catálogo versionado; `core_orders` separa el historial inmutable del catálogo; clientes, pagos, impresión, auditoría y rate limits tienen tablas propias.

Todas las tablas operativas incluyen `restaurant_id`. Aunque la instalación inicial sea dedicada, las uniques, consultas y RPCs nunca dependen de un “tenant implícito”.

## Acceso

RLS está habilitada y `anon`/`authenticated` no reciben permisos. Solo la API server-side usa `service_role`. Los navegadores nunca consultan Supabase directamente.

## Transacción de pedidos

`core_place_order`:

1. busca un pedido anterior por idempotencia;
2. bloquea restaurante y catálogo;
3. vuelve a validar producto, disponibilidad, modificadores y precios;
4. valida promoción, delivery y total;
5. descuenta stock;
6. asigna el número correlativo;
7. guarda pedido/cliente/auditoría;
8. devuelve el mismo pedido en reintentos.

Esto evita que dos solicitudes descuenten el mismo stock o que el navegador altere importes.

## Migración 0003 (correcciones de integridad)

Aditiva (`create or replace` + objetos nuevos): se aplica encima de 0001/0002. Cambios:

- `core_place_order` fija `status='new'` y `paymentStatus='pending'` (no confía en el llamador) y valida también en SQL mínimo/máximo/duplicados de modificadores y la vigencia de la promoción.
- `core_update_order_status`: compare-and-set sobre el estado esperado; sólo toca `status` dentro de `data` (no pisa un pago concurrente) y, al cancelar, devuelve el stock.
- `core_reconcile_payment`: un pago aprobado no retrocede por notificaciones tardías; `refunded` es terminal.
- Los pedidos de Mercado Pago se encolan para imprimir cuando se aprueban el pago, no al crearse.
- Commerce: `core_commerce_catalog` (una sola lectura, sin el corte de 1000 filas de PostgREST), `core_commerce_save_product` (producto + variantes en una transacción, conserva los ids), `core_commerce_dashboard` (agregados en SQL) y `core_commerce_update_order_status` (CAS + stock al cancelar). `core_commerce_variants.position` fija el orden de talles.
- `core_purge_expired()`: limpia `core_rate_limits` y `core_mp_oauth_attempts`. Programala una vez por día (pg_cron / Supabase Cron).

`scripts/test-sql.sh` aplica las migraciones a una base de prueba y ejecuta `tests/sql/integrity.sql`.

## Revisión del catálogo y stock

`core_catalog_state.revision` sube con cada pedido (el stock vive dentro del JSON del catálogo). Consecuencia: un `PUT /admin/catalog` con una revisión vieja recibe 409 si entró un pedido mientras se editaba. Es seguro pero molesto en locales con mucho movimiento; antes de construir la edición de catálogo en el admin conviene mover el stock a su propia tabla.
