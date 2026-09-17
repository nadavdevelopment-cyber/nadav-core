# Mapa de extracción desde NADAV Food

Fuente auditada: `DanteCarrizo/nadav_food`, `main` en `594bf63a5783675f195ad95d5796fb5b35f8a524`.

| NADAV Food | NADAV Core | Decisión | Motivo |
| --- | --- | --- | --- |
| `types/index.ts` | `packages/core/src/types.ts` | Adaptado | Se eliminaron `Business`, plan SaaS y nombres acoplados; contratos de restaurante independientes. |
| `services/commerce.ts` | `packages/core/src/pricing.ts`, `orders.ts` | Adaptado | Conserva validación server-side, modificadores, promociones, stock, delivery y estados sin `hasCapability(plan)`. |
| `server/service.ts` | `packages/core/src/repository.ts`, `packages/adapters/src/supabase.ts` | Adaptado | Se reemplaza el servicio monolítico por puerto/repositorio y adaptador. |
| `server/mutation.ts` | Dominio + `core_place_order` | Adaptado | Validación tipada y transacción SQL; no se conserva el documento del SaaS. |
| `server/http.ts` | `packages/adapters/src/http.ts` | Reutilizado/adaptado | Límites, Origin y errores; ahora admite allowlist de storefronts. |
| `server/auth.ts` | `admin-auth.ts` + contratos futuros | Adaptado | V1 dedicada usa token inicial y cookie HMAC HttpOnly; no arrastra usuarios/superadmin comerciales. |
| `server/media-core.ts`, `server/media.ts` | `packages/adapters/src/media.ts` | Reutilizado/adaptado | Firma de archivos, 2 MB, aislamiento por restaurante y Storage dedicado. |
| `server/mercadopago/oauth-core.ts`, `oauth.ts` | `packages/adapters/src/mercadopago.ts` | Reutilizado/adaptado | PKCE, tokens cifrados, refresh y cuenta del restaurante. |
| `server/mercadopago/payment-core.ts`, `payments.ts` | `mercadopago.ts` + webhook v1 | Reutilizado/adaptado | Precio server-side, referencia externa, preferencia idempotente y conciliación. |
| `services/printnode-*` | `packages/adapters/src/printnode.ts` | Reutilizado/adaptado | API key por restaurante cifrada, selección validada, cola, prueba e idempotencia. |
| `app/api/orders`, `quote`, `menu` | `apps/core-api/app/api/v1/*` | Adaptado | API headless versionada y consumible por dominios distintos. |
| `components/storefront.tsx` | `apps/demo`, starter | Adaptado | Se usa solo el flujo funcional; se descarta la identidad visual del SaaS/demos. |
| `components/admin/*` | `packages/admin-ui` y `/admin` | Adaptado | Shell operativo común sin planes ni billing. |
| `hooks/store.tsx` | SDK + estado local de cada frontend | Descartado/adaptado | Mezclaba datos de UI, sesión y SaaS; Core ofrece contratos explícitos. |
| `supabase/schema.sql` | `supabase/migrations/0001_core_schema.sql` | Adaptado | Esquema nuevo, sin historia, demos ni planes; conserva RLS cerrada, RPCs y CAS/idempotencia. |
| Migraciones MP/PrintNode | Migración Core única | Adaptado | Se integran solo piezas técnicas aplicables a un proyecto nuevo. |
| `tests/commerce`, MP y PrintNode | `tests/*` | Reutilizado/adaptado | Se conservan invariantes, no fixtures de marcas o planes. |
| Landing, registro, billing, superadmin | Ninguno | Excluido | Exclusivo del producto NADAV Food. |
| `lib/billing-catalog.ts`, `server/billing/*` | Ninguno | Excluido | Cobro de suscripciones de NADAV, no del restaurante. |
| `server/plans.ts` | `RestaurantFeatures` | Descartado/adaptado | Feature flags por proyecto, sin Basic/Pro/Premium. |
| Demos y rebranding | `supabase/seed/0001_demo_restaurant.sql` genérico | Excluido | No se incluyen Biggie’s, Gloton, Melman’s ni Mumi’s. |
| Marketing, legal SaaS y Sentry del producto | Ninguno | Excluido | Responsabilidad de cada producto/despliegue, no del motor gastronómico. |
