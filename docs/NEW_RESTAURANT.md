# Crear un restaurante nuevo

1. Desde la raíz de Core, creá el frontend:

   ```bash
   node scripts/create-restaurant.mjs cliente-a
   ```

2. Editá `apps/cliente-a/restaurant.config.ts`. La sección `presentation` pertenece al frontend y puede reemplazarse completamente.
3. Creá un proyecto Supabase dedicado.
4. Aplicá `supabase/migrations/0001_core_schema.sql` en una base vacía. No apliques el seed demo.
5. Insertá el restaurante y su catálogo inicial con UUIDs propios. Usá `restaurant.config.ts` como contrato de configuración.
6. Copiá `.env.example` a `.env.local` y configurá `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NADAV_CORE_RESTAURANT_ID`, orígenes, secretos administrativos y claves de cifrado.
7. Para Mercado Pago, registrá una app OAuth por despliegue o una app NADAV con redirect permitido; conectá la cuenta desde el admin.
8. Para PrintNode, el restaurante crea su cuenta, instala PrintNode Client y conecta su API key desde el admin. La clave se cifra antes de persistirse.
9. Configurá el frontend con:

   ```env
   NEXT_PUBLIC_NADAV_CORE_URL=https://core.cliente.com
   NEXT_PUBLIC_NADAV_RESTAURANT_SLUG=cliente-a
   ```

10. Verificá catálogo → cotización → pedido → pago → webhook → impresión antes de producción.

El storefront puede ser reemplazado por un diseño desde cero. Solo debe conservar el contrato del SDK o de `/api/v1`.
