# Seguridad

## Controles incluidos

- Secretos en módulos y rutas server-only; el SDK público no exporta adaptadores.
- RLS activa y sin permisos para `anon`/`authenticated`.
- Allowlist de Origin para escrituras desde storefronts independientes.
- Payloads limitados y errores públicos estables.
- Rate limiting persistente en producción.
- Precios, modificadores, promociones, delivery y stock recalculados en servidor y revalidados en SQL.
- UUID de idempotencia obligatorio para crear pedidos.
- Tokens Mercado Pago y PrintNode cifrados con AES-256-GCM y AAD por restaurante.
- Webhook Mercado Pago con firma y consulta server-to-server.
- Cookie administrativa HttpOnly, Secure en HTTPS, SameSite=Lax y firma HMAC.
- CSP, anti-framing, nosniff, Referrer-Policy y Permissions-Policy.
- Storage limitado a JPG/PNG/WebP de 2 MB y rutas por restaurante.
- Auditoría para pedidos, pagos y operaciones sensibles.

## Endurecimientos posteriores a la revisión

- Las rutas del admin dedicado (`/api/v1/admin/*`) sólo aceptan `APP_ORIGIN`; los orígenes de storefront ya no pueden operarlas.
- El login del admin tiene rate limit (10 intentos / 15 min por dirección) y vuelve al formulario en vez de mostrar JSON.
- `GET /orders/:id` devuelve una vista pública (sin teléfono, email, dirección ni notas) y tiene rate limit.
- Todos los identificadores que llegan por URL se validan como UUID y los filtros PostgREST se codifican.
- `NADAV_CORE_DEMO_MODE=true` es rechazado en Vercel production.

## Límites conocidos

- CSP con `script-src 'unsafe-inline'` (necesario para Next sin nonces). Migrar a nonces en el admin.
- El admin Commerce usa cookie `SameSite=None` (panel en otro dominio): un XSS en el storefront equivale a acceso admin, y Safari/ITP puede bloquearla. Preferible servir el panel desde el dominio de Core o proxyar `/api` por el mismo origen.
- La sesión Commerce guarda el rol por 12 h: revocar un usuario no surte efecto hasta que expira.
- El rate limit usa `X-Forwarded-For`: sólo es confiable detrás de un proxy que lo sobrescriba (Vercel, Cloudflare).

## Responsabilidades del despliegue

- Usar secretos aleatorios distintos por entorno.
- Restringir `NADAV_CORE_ALLOWED_ORIGINS` a dominios exactos.
- Rotar el token administrativo y claves de proveedor.
- Configurar backups y probar restauración.
- Proteger el endpoint de despacho/cron con autenticación al incorporarlo.
- Ejecutar análisis de dependencias y pruebas antes de cada release.

## Límite V1

El admin dedicado usa una credencial inicial única con sesión firmada. Para equipos con múltiples operadores, debe incorporarse un proveedor de identidad o usuarios con roles antes de conceder accesos individuales.
