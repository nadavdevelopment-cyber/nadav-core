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
