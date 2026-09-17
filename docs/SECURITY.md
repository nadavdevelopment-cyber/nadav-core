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

## Responsabilidades del despliegue

- Usar secretos aleatorios distintos por entorno.
- Restringir `NADAV_CORE_ALLOWED_ORIGINS` a dominios exactos.
- Rotar el token administrativo y claves de proveedor.
- Configurar backups y probar restauración.
- Proteger el endpoint de despacho/cron con autenticación al incorporarlo.
- Ejecutar análisis de dependencias y pruebas antes de cada release.

## Límite V1

El admin dedicado usa una credencial inicial única con sesión firmada. Para equipos con múltiples operadores, debe incorporarse un proveedor de identidad o usuarios con roles antes de conceder accesos individuales.
