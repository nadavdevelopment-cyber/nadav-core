# Despliegue

## Core API

1. Crear un proyecto Supabase dedicado y backup inicial.
2. Aplicar las migraciones en orden (`0001_core_schema.sql`, `0002_commerce_schema.sql` si usás Commerce, `0003_integrity_fixes.sql`). Programar `select public.core_purge_expired();` una vez por día.
3. Insertar restaurante y catálogo; no usar el seed demo en producción.
4. Configurar todas las variables server-only en el hosting.
5. Desplegar `apps/core-api` con Node.js 22+.
6. Configurar los redirects OAuth y webhook de Mercado Pago sobre el dominio final.
7. Verificar el bucket `nadav-core-media`.

## Frontend

Desplegar cada app desde `apps/<cliente>` como proyecto independiente. Solo necesita las dos variables `NEXT_PUBLIC_NADAV_CORE_*`; ningún secreto del backend.

## Checklist

- `NADAV_CORE_DEMO_MODE=false`
- `NADAV_CORE_STOREFRONT_URL` apuntando al storefront (retorno de Mercado Pago)
- HTTPS y dominio final en `APP_ORIGIN`
- allowlist exacta de todos los storefronts
- claves de cifrado respaldadas
- Mercado Pago conectado y webhook firmado probado
- PrintNode probado físicamente si está activo
- backup/restauración comprobados
- `npm ci`, typecheck, tests y build exitosos
- smoke test de catálogo, pedido, idempotencia y estado
