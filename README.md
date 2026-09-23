# NADAV Core

Infraestructura gastronómica **headless-first** para crear sitios individuales de restaurantes sin repetir catálogo, checkout, pedidos, pagos, impresión ni seguridad.

NADAV Core no reemplaza a NADAV Food. Fue extraído conceptualmente de `DanteCarrizo/nadav_food@594bf63a5783675f195ad95d5796fb5b35f8a524`; el repositorio fuente se auditó como solo lectura y no fue modificado.

## Qué contiene

- `packages/core`: dominio tipado, precios, modificadores, promociones, delivery, stock y estados.
- `packages/adapters`: Supabase, Storage, Mercado Pago del restaurante, PrintNode, cifrado, seguridad HTTP y repositorios.
- `packages/sdk`: cliente para storefronts que no conocen SQL ni proveedores externos.
- `packages/admin-ui`: shell administrativo común y reutilizable.
- `apps/core-api`: API headless y administración de una instalación dedicada.
- `apps/demo`: frontend independiente conectado a Core.
- `apps/vera-studio`: storefront editorial y administración Commerce conectados al mismo Core.
- `starters/nadav-restaurant-starter`: base neutra para nuevos clientes.
- `supabase/migrations`: esquema Core limpio y transaccional.
- `supabase/seed`: datos opcionales de demostración, separados del esquema.

## Inicio local

```bash
npm ci
cp .env.example .env.local
npm run dev:core
```

En otra terminal:

```bash
npm run dev:demo
```

Con `NADAV_CORE_DEMO_MODE=true`, la API usa un repositorio en memoria para probar catálogo y pedidos sin Supabase. La persistencia, Mercado Pago, Storage y PrintNode requieren la configuración real documentada.

## Verificación

```bash
npm run typecheck
npm test
npm run build
DATABASE_URL=postgres://... npm run test:sql   # migraciones + funciones SQL contra un PostgreSQL de prueba
```

## Principios

1. El servidor es la única fuente de precios.
2. Cada operación lleva `restaurant_id`, incluso en instalaciones dedicadas.
3. Los secretos nunca llegan al SDK o al storefront.
4. Pedidos, pagos e impresión son idempotentes.
5. El storefront es reemplazable; Core no impone marca, layout ni animaciones.

Consultá [la arquitectura](docs/ARCHITECTURE.md) y [cómo crear un restaurante](docs/NEW_RESTAURANT.md).

## Vera Studio Commerce

Commerce agrega productos, categorías, variantes, stock, clientes, pedidos y contenido sin duplicar Supabase ni autenticación. Aplicá después del esquema base:

```bash
supabase db push
node scripts/assign-commerce-admin.mjs
```

El script usa `SUPABASE_SERVICE_ROLE_KEY` sólo localmente para asignar un usuario ya creado en Supabase Auth. En Vercel configurá `SUPABASE_ANON_KEY` para el login de administradores y agregá el origen público de Vera a `NADAV_CORE_ALLOWED_ORIGINS`. El storefront usa `NEXT_PUBLIC_NADAV_CORE_URL` y `NEXT_PUBLIC_NADAV_RESTAURANT_SLUG=vera-studio`.
