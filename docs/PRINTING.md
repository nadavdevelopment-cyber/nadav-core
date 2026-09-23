# PrintNode

Cada restaurante conecta su propia cuenta PrintNode. No hay API key global.

## Garantías

- La API key se valida listando impresoras y se guarda cifrada con AES-256-GCM y AAD por restaurante.
- Solo puede seleccionarse una impresora devuelta por esa cuenta.
- El trigger crea como máximo un trabajo automático por pedido.
- PrintNode recibe una clave de idempotencia estable por trabajo.
- Un fallo de impresión nunca revierte ni elimina el pedido.
- La reimpresión manual usa un trabajo diferente y auditable.
- El storefront/admin puede conservar `window.print()` como fallback visual.

## Variable

`PRINTNODE_TOKEN_ENCRYPTION_KEY`, generada con `openssl rand -base64 32`.

Antes de producción probá una impresora física en 58/80 mm. La aceptación del job por PrintNode no garantiza que el papel haya salido; monitoreá también el cliente local y la impresora.

## Cambios posteriores a la revisión

- Los pedidos de Mercado Pago se imprimen al aprobarse el pago (el webhook dispara el trabajo); efectivo y transferencia, al crearse.
- El ticket usa la zona horaria del restaurante y formato de 24 h.
- Reimpresión manual: `POST /api/v1/admin/printnode` con `{"action":"reprint","orderId":"..."}` crea un trabajo `manual` nuevo y auditado.
- Un trabajo trabado en `processing` por más de 5 minutos puede reclamarse de nuevo. Los trabajos fallidos pueden reintentarse mediante el endpoint de mantenimiento, con límite de intentos para evitar reintentos infinitos.
