# Arquitectura

## Límites

```text
Storefront individual
  → @nadav/sdk
    → apps/core-api (/api/v1)
      → @nadav/core (dominio puro)
      → @nadav/adapters (infraestructura server-only)
        → Supabase/PostgreSQL, Mercado Pago, PrintNode, Storage
```

El frontend conoce productos, carrito, checkout y pedidos. No conoce tablas, claves de servicio, tokens OAuth, API keys de PrintNode ni reglas SQL.

## Capas

### Dominio (`packages/core`)

Sin React ni Supabase. Define configuración, catálogo, modificadores, cálculo de precios, promociones, delivery, creación y transición de pedidos. Se prueba con Node sin red.

### Puertos y adaptadores (`packages/adapters`)

`CoreRepository` permite usar Supabase o memoria. Los demás adaptadores encapsulan OAuth/pagos, webhooks, Storage, cifrado AES-256-GCM y PrintNode.

### API (`apps/core-api`)

Expone contratos versionados `/api/v1`. Aplica origen permitido, límites de tamaño, rate limiting, idempotencia y mensajes de error estables.

### SDK (`packages/sdk`)

Ofrece una API pequeña:

```ts
nadav.catalog.get()
nadav.cart.quote(checkout)
nadav.checkout.createOrder(checkout, idempotencyKey)
nadav.orders.get(orderId)
```

### Storefronts

`apps/demo` y el starter son aplicaciones separadas. Pueden reemplazarse por cualquier frontend que respete el contrato HTTP.

## Instalación dedicada y futuro multi-tenant

La primera modalidad recomendada es un despliegue y una base dedicados por cliente. Aun así, todas las claves y constraints incluyen `restaurant_id`; eso permite evolucionar hacia despliegues compartidos sin reescribir el dominio. No se expone acceso de navegador directo a las tablas.

## Consistencia

El servidor recalcula el pedido desde el catálogo. `core_place_order` vuelve a validar precios, modificadores, stock, promoción, delivery y total dentro de una transacción, bloquea catálogo/restaurante, descuenta stock y resuelve reintentos por `idempotency_key`.
