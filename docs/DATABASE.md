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
