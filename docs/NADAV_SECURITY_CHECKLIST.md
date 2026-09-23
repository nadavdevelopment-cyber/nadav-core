---
name: "nadav-security-checklist-v2"
description: "Audita seguridad y preparación para producción de NADAV Core después de Bagdad v2. Usar antes de lanzar un cliente real, después de cambios en Core/pagos/auth/base de datos/impresión, o para auditorías periódicas. Revisa aislamiento server-only de Supabase, secretos, acceso admin, pedidos, idempotencia, Mercado Pago, PrintNode, Commerce, migraciones, backups, CI y riesgos conocidos."
---

# NADAV Security Checklist v2 — Post Bagdad

Esta skill realiza una auditoría de seguridad y preparación para producción de **NADAV Core**. Está adaptada al modelo actual posterior a Bagdad v2.

Su objetivo es responder una pregunta concreta:

> ¿Hay algo que pueda exponer datos, cobrar mal, aceptar pedidos inconsistentes, permitir acceso administrativo indebido o dejar un cliente real operando sin recuperación suficiente?

No reemplaza un pentest externo, una revisión legal ni las pruebas reales de proveedores. Sí funciona como **gate de producción repetible** para el equipo NADAV.

## Principios obligatorios

1. **Auditar primero; no corregir automáticamente.**
   - No modificar RLS, policies, secretos, roles, variables de producción, migraciones, Mercado Pago, PrintNode, backups ni accesos sin aprobación explícita del usuario.
   - No ejecutar `supabase db push`, rotaciones, deletes, refunds, cambios de permisos ni acciones destructivas como parte del checklist.

2. **Todo ✅ necesita evidencia.**
   - No marcar un control como verificado por inferencia o porque "debería estar".
   - Indicar brevemente la evidencia: archivo/linea revisada, comando, query, configuración de plataforma, test, smoke test o resultado del proveedor.
   - Si no hay acceso suficiente: ⚠️, nunca ✅.

3. **Distinguir diseño de configuración real.**
   - Que el repo implemente un control no demuestra que producción lo tenga configurado.
   - Ejemplo: el código puede soportar cifrado, pero la key real puede faltar; la migración puede existir, pero no estar aplicada.

4. **No inventar topología.**
   - Determinar si el despliegue usa una base **compartida multi-tenant** o una **instalación dedicada**.
   - Si no puede determinarse con evidencia, preguntar antes de emitir un veredicto sobre aislamiento.

5. **Modelo RLS correcto de NADAV Core.**
   - NADAV Core actual usa un modelo **server-only** para Supabase: RLS activa + `anon`/`authenticated` sin acceso directo + operaciones de datos desde servidor con `service_role`.
   - **La ausencia de policies para `anon`/`authenticated` NO es una falla por sí sola.**
   - Sólo exigir policies tenant-aware si existe acceso directo desde navegador/cliente autenticado a tablas protegidas.

## Antes de empezar

No hacer preguntas que puedan resolverse revisando el repo o la configuración accesible.

Sólo pedir lo que falte y cambie materialmente la evaluación:

- ¿Es auditoría **pre-lanzamiento**, **post-cambio importante** o **periódica**?
- ¿El entorno objetivo es **producción**, **staging** o ambos?
- ¿Supabase es **compartido multi-tenant** o **dedicado por cliente**?
- ¿Están habilitados Mercado Pago, PrintNode y/o Commerce para este cliente?
- ¿Qué plataformas pueden verificarse en esta sesión: GitHub, Vercel, Supabase, Mercado Pago, PrintNode?

Si el usuario pide "auditá NADAV Core" sin más detalle, empezar por el repo y marcar como ⚠️ todo lo que requiera acceso externo no disponible.

---

# Estados y severidad

Usar sólo estos estados:

- ✅ **Verificado / OK**
- ⚠️ **No verificado, parcial, riesgo aceptado o mejora pendiente**
- ❌ **Falla encontrada**

Asignar severidad cuando haya ⚠️ o ❌:

- **P0 — Bloqueante:** no lanzar ni sumar dinero/datos reales hasta resolver.
- **P1 — Alta:** resolver antes o inmediatamente después del lanzamiento con responsable y fecha.
- **P2 — Media:** mejora importante, no necesariamente bloqueante.
- **P3 — Baja:** higiene, mantenimiento o defensa adicional.

---

# Evidencia mínima recomendada

Priorizar, en este orden:

1. **Código actual en `main`** y diff de cambios recientes.
2. **Tests y builds** ejecutados sobre el commit que se quiere desplegar.
3. **Estado de migraciones** de la base objetivo.
4. **Configuración real** de Vercel/Supabase/proveedores.
5. **Smoke tests** contra el entorno objetivo.
6. **Pruebas de proveedor**: Mercado Pago sandbox, PrintNode físico, restore de backup.

Nunca imprimir valores de secretos en el informe. Mostrar sólo nombre, existencia, entorno, antigüedad/rotación si se conoce y si está correctamente clasificado.

---

# Checklist

## 1. Integridad del release y del repositorio

- `main` está limpio y el commit auditado es exactamente el que se va a desplegar.
- `npm run typecheck` pasa.
- `npm test` pasa.
- `npm run build` pasa para Core, Demo y Starter cuando correspondan.
- `npm run test:sql` pasa contra una **base de pruebas**, nunca contra producción salvo que el script sea demostrado como read-only.
- GitHub Actions existe y corre sobre el commit/PR relevante.
- No hay cambios de seguridad o migraciones pendientes fuera del commit auditado.
- `NADAV_CORE_DEMO_MODE=true` no puede quedar activo en producción.

**P0 si:** producción ejecuta código distinto del auditado, DEMO_MODE está activo, o el release crítico no compila/testea.

## 2. Aislamiento de datos y Supabase server-only

### Modelo esperado actual

Para cada tabla sensible de Core y Commerce:

- RLS está activa.
- `anon` y `authenticated` no tienen privilegios directos que permitan leer/escribir datos de negocio.
- `SUPABASE_SERVICE_ROLE_KEY` se usa sólo en servidor.
- Ningún bundle, SDK público, storefront o variable `NEXT_PUBLIC_*` contiene `service_role`.
- Los accesos de repositorio/RPC están siempre asociados a `restaurant_id` cuando corresponde.
- Los identificadores de restaurante no se confían sólo desde el navegador: Core resuelve/valida el tenant.
- RPCs sensibles tienen `search_path` explícito y permisos limitados al rol esperado.

### Policies

- **No exigir una policy por tabla** mientras el acceso sea server-only y `anon`/`authenticated` estén revocados.
- Si se detecta acceso directo desde browser/Supabase client autenticado, entonces sí verificar policies tenant-aware y tratar su ausencia como P0.

### Multi-tenant compartido

- Intentar demostrar que un tenant A no puede leer ni modificar datos de tenant B.
- Revisar tablas Food, Commerce, media/storage, pedidos, clientes, pagos, conexiones de proveedor, impresión y membresías.
- Las rutas/funciones por `slug`, UUID o `restaurant_id` deben impedir cross-tenant access.

**P0 si:** existe cualquier lectura/escritura cross-tenant, acceso directo no previsto de `anon`/`authenticated`, o service role expuesta al cliente.

## 3. Storage y archivos

- Bucket(s) tienen límites de tamaño y MIME esperados.
- Las rutas de media se separan por restaurante/tenant.
- Un tenant no puede sobrescribir o borrar media de otro tenant.
- No se permiten URLs de imagen peligrosas (`javascript:`, protocol-relative no confiable, etc.).
- Uploads no aceptan tipos arbitrarios ejecutables.

## 4. Secretos y credenciales

- No hay `.env`, `.env.local` ni backups de secretos commiteados.
- `.env.example` contiene sólo nombres y valores ficticios/vacíos.
- Revisar historial con una herramienta de secret scanning cuando sea posible (`gitleaks` o equivalente), no sólo el estado actual.
- Ninguno de estos secretos tiene prefijo `NEXT_PUBLIC_`:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NADAV_CORE_ADMIN_TOKEN`
  - `NADAV_CORE_SESSION_SECRET`
  - `MERCADOPAGO_CLIENT_SECRET`
  - `MERCADOPAGO_TOKEN_ENCRYPTION_KEY`
  - `MERCADOPAGO_WEBHOOK_SECRET`
  - `PRINTNODE_TOKEN_ENCRYPTION_KEY`
- Las keys de producción son distintas de staging/dev cuando corresponda.
- `NADAV_CORE_SESSION_SECRET` es suficientemente aleatorio.
- Las claves AES requeridas tienen el formato/tamaño esperado y están respaldadas de forma segura.
- Tokens OAuth de Mercado Pago están cifrados en reposo con AAD por restaurante.
- API keys de PrintNode están cifradas en reposo con AAD por restaurante.
- No hay secretos completos en logs, errores, issues, PRs o documentación.

**P0 si:** hay un secreto de producción expuesto o accesible desde el navegador. Si se encuentra uno, recomendar rotación además de removerlo.

## 5. Orígenes, CORS y superficie HTTP

- `NADAV_CORE_ALLOWED_ORIGINS` contiene sólo dominios exactos necesarios.
- No hay `*` para endpoints con credenciales o datos sensibles.
- `/api/v1/admin/*` acepta únicamente `APP_ORIGIN`, no los storefront origins.
- `readJson` exige origin válido para escrituras y mide el límite en **bytes**, no caracteres.
- Payloads tienen límites razonables.
- UUIDs de URL se validan estrictamente antes de construir filtros.
- Valores interpolados en PostgREST están codificados/validados.
- Timeouts de proveedores se transforman en errores controlados (`504` o equivalente).
- Errores internos no filtran stack traces, SQL, claves ni secretos al cliente.

## 6. Headers y navegador

Verificar en runtime:

- HTTPS/TLS.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options` o `frame-ancestors` equivalente.
- `Referrer-Policy`.
- `Permissions-Policy`.
- CSP activa.

Riesgo conocido post-Bagdad:

- `script-src 'unsafe-inline'` sigue siendo una deuda. Marcar ⚠️ P2 mientras exista, salvo que se demuestre una explotación concreta o contenido script controlable por usuarios.

## 7. Autoridad del servidor: precios, pedidos y stock

- El navegador nunca define el total final.
- Core recalcula precios, modificadores, promociones, delivery y stock.
- SQL revalida invariantes críticas antes de persistir.
- `status='new'` y `paymentStatus='pending'` iniciales se fuerzan server-side.
- Modificadores respetan `min/max` y no aceptan duplicados.
- Promociones respetan vigencia y productos elegibles.
- El stock se valida por total agregado del mismo producto cuando aparece varias veces.
- Cancelar pedidos devuelve stock una sola vez.
- Cambios de estado usan compare-and-set y no pisan cambios de pago concurrentes.
- Pedidos inexistentes producen error controlado, no 500.

## 8. Idempotencia

- Crear pedido requiere UUID válido en `Idempotency-Key`.
- El mismo checkout + misma key devuelve el mismo pedido.
- Misma key + checkout distinto devuelve `409 IDEMPOTENCY_CONFLICT`.
- La comparación incluye como mínimo:
  - items/cantidades/modificadores/notas por línea
  - cliente
  - modo
  - medio de pago
  - dirección
  - zona de delivery
  - promoción
  - notas generales
- Un retry válido funciona aunque después cambien horario, stock o precio.
- La base tiene unicidad suficiente para resolver carreras concurrentes.

**P0 si:** un retry puede duplicar cobros/pedidos o una key puede reutilizarse silenciosamente para otro pedido.

## 9. Datos públicos y privacidad de pedidos

- `GET /api/v1/orders/:id` no devuelve teléfono, email, dirección, notas privadas, idempotency key ni identificadores internos innecesarios.
- Tiene rate limiting.
- Los UUIDs no se tratan como autenticación: minimizar siempre la información pública.
- Los logs no contienen PII innecesaria.

## 10. Admin Food

- Login tiene rate limit.
- Sesión firmada con HMAC.
- Cookie `HttpOnly`.
- `Secure` en HTTPS/producción.
- `SameSite=Lax` para admin dedicado cuando aplica.
- Rutas admin sólo aceptan `APP_ORIGIN`.
- Cambios sensibles generan auditoría cuando corresponda.
- Token/secret de admin no aparece en frontend.

Límite conocido:

- El admin dedicado V1 usa credencial inicial única. Si hay múltiples operadores con permisos individuales, marcar ⚠️ P1 hasta incorporar identidad/roles adecuados.

## 11. Admin Commerce

- Sesiones firmadas y ligadas a tenant.
- Roles sólo aceptan valores conocidos (`owner/admin/editor`) y no claves heredadas del prototipo.
- Un usuario de tenant A no puede operar tenant B.
- Revocar una membresía debe tener efecto en un plazo aceptable.

Riesgos conocidos post-Bagdad:

- Cookie Commerce `SameSite=None` cuando panel y Core están cross-domain: ⚠️ P1/P2 según exposición real.
- El rol queda cacheado en la cookie hasta ~12 h: ⚠️ P1 si se requiere revocación inmediata.
- Preferir panel mismo origen que Core o proxy same-origin cuando sea viable.

## 12. Mercado Pago

Si Mercado Pago está deshabilitado, marcar N/A en lugar de fallar.

Si está habilitado:

- OAuth usa PKCE y `state` de un solo uso/expirable.
- Access/refresh tokens cifrados por restaurante.
- Preference se crea usando total persistido/calculado por servidor.
- `external_reference` liga restaurante + pedido.
- Webhook exige firma.
- El pago se consulta server-to-server a Mercado Pago antes de confiar en el webhook.
- Verificar `collector_id`, moneda, importe, referencia y `preference_id`.
- Máquina de estados impide downgrade de `approved` por notificación vieja.
- `refunded` y `charged_back` se representan explícitamente y son terminales.
- Reserva `creating` expira/se recupera si un request muere.
- `NADAV_CORE_STOREFRONT_URL` apunta al storefront correcto en producción.
- Pedidos MP se imprimen sólo al aprobarse el pago.
- Mismatch de pago queda auditado y no genera loops infinitos de webhook.

### Smoke test obligatorio antes de dinero real

Probar en sandbox o entorno seguro:

1. crear pedido;
2. crear preference;
3. completar pago aprobado;
4. recibir webhook;
5. confirmar `paymentStatus=approved`;
6. volver al storefront correcto;
7. confirmar ticket/cola de impresión si aplica;
8. probar al menos un estado no aprobado;
9. cuando el proveedor/entorno lo permita, probar o simular de forma controlada refund/chargeback.

**P0 si:** un pago puede aprobarse por datos del cliente sin verificación server-to-server, un aprobado puede degradarse indebidamente, o monto/merchant/referencia no se validan.

Riesgo conocido:

- Cancelar un pedido pagado todavía requiere un flujo de refund de negocio explícito. Si el comercio opera MP real y permite cancelaciones pagadas sin proceso definido: ⚠️ P1.

## 13. PrintNode

Si PrintNode está deshabilitado, marcar N/A.

Si está habilitado:

- Cada restaurante conecta su propia cuenta/API key.
- API key cifrada por restaurante.
- Sólo se puede seleccionar una impresora perteneciente a esa cuenta.
- Trabajo automático idempotente por pedido.
- Pedidos MP se encolan sólo después de `approved`.
- Efectivo/transferencia siguen la política de negocio definida.
- Reimpresión manual genera job distinto y auditable.
- Job trabado en `processing` puede reclamarse tras timeout.
- Fallo de impresión nunca elimina/revierte el pedido.
- Se probó impresora física 58/80 mm antes de producción.

Riesgo conocido:

- Falta un dispatcher/cron periódico para reintentar `failed`. Si la operación depende de autoimpresión sin monitoreo humano: ⚠️ P1.

## 14. Commerce: pagos y consistencia

- `core_commerce_save_product` es transaccional y preserva IDs de variantes existentes.
- Catálogo Commerce no depende de múltiples lecturas susceptibles al límite silencioso de PostgREST.
- Dashboard usa agregados de base, no un subconjunto fijo de pedidos.
- Cancelar devuelve stock.
- Estado de pedido usa compare-and-set.
- Validación de productos coincide con constraints DB.

Riesgos conocidos:

- `card` puede ser sólo demostración y no equivaler a cobro real.
- Si `card` aparece a clientes reales sin gateway real: ❌ P0.
- Debe existir un camino claro para marcar transferencias/pagos como aprobados antes de presentar "ingresos" como cobrados.

## 15. Migraciones y drift de base

- `supabase migration list` muestra las migraciones locales y remotas alineadas.
- En Core post-Bagdad, `0003_integrity_fixes.sql` debe estar aplicada en el entorno auditado.
- Antes de cualquier push, `supabase db push --dry-run` debe mostrar sólo migraciones esperadas.
- No ejecutar el push real desde esta skill.
- Revisar que constraints y funciones críticas de producción correspondan al código esperado.

Riesgo conocido:

- `0002_commerce_schema.sql` contiene seed de Vera Studio. Para nuevas instalaciones, recomendar separar seed de migración. ⚠️ P2/P1 según estrategia de provisioning.

## 16. Backups y recuperación

- Backups automáticos habilitados en Supabase según el plan disponible.
- PITR habilitado cuando el nivel de criticidad/plan lo permite.
- Existe una política de retención de backups.
- Se realizó al menos una prueba de restauración real o rehearsal documentado.
- Existe procedimiento para restaurar sin sobrescribir accidentalmente producción.
- Las claves de cifrado necesarias para leer tokens respaldados también tienen recuperación segura.

**P0/P1 según negocio** si no hay ninguna recuperación viable para datos reales pagados.

## 17. Housekeeping y crecimiento

- `core_purge_expired()` existe.
- Está programado periódicamente en producción (Supabase Cron/pg_cron u otra solución).
- Se monitorea crecimiento de tablas de rate limit, OAuth, audit y jobs.
- `listOrders` y otras lecturas con límites tienen estrategia de paginación antes de escalar.

Riesgos conocidos:

- `listOrders` puede seguir limitado a un máximo fijo: ⚠️ P2 antes de alto volumen.

## 18. Rate limiting y proxy trust

- Endpoints sensibles tienen rate limiting donde corresponde.
- Login admin limitado.
- Public order lookup limitado.
- Creación de pedidos limitada de forma razonable.
- `X-Forwarded-For` sólo se confía cuando el despliegue está detrás de un proxy que lo sobrescribe (por ejemplo Vercel/Cloudflare).
- No confiar en XFF suministrado libremente por el cliente en un despliegue directo.

## 19. Dependencias y supply chain

- Lockfile presente y usado en CI (`npm ci` cuando corresponda).
- `npm audit` o scanner equivalente ejecutado recientemente.
- No considerar cualquier warning automáticamente bloqueante: clasificar por severidad, exploitabilidad y si alcanza código/runtime usado.
- Dependencias críticas/abandonadas identificadas.
- GitHub Actions revisadas; evitar workflows con permisos excesivos.
- Branch protection/reviews obligatorios según tamaño del equipo y criticidad.
- Secret scanning de GitHub habilitado si está disponible.

## 20. Accesos humanos y cuentas de plataforma

No hardcodear nombres de personas. Auditar el estado real.

Para GitHub, Vercel, Supabase, Mercado Pago y cualquier proveedor:

- Sólo personas que actualmente necesitan acceso lo conservan.
- 2FA/MFA habilitado donde la plataforma lo soporte y sea apropiado.
- No hay cuentas de prueba, colaboradores externos o exempleados con privilegios altos innecesarios.
- Principio de mínimo privilegio.
- Tokens personales no se comparten entre personas.
- Cuentas de servicio identificadas y separadas de usuarios humanos.

## 21. Privacidad y datos personales

Para producción con usuarios reales:

- Política de privacidad accesible.
- Inventario básico de datos personales almacenados.
- Definición de retención.
- Procedimiento para corrección/eliminación/exportación cuando corresponda.
- Datos públicos de pedidos minimizados.
- Acceso administrativo a PII limitado y auditable.
- Backups contemplados en la política de retención.

Para obligaciones legales específicas (incluida normativa argentina), marcar ⚠️ si no hubo revisión jurídica competente; no presentar esta skill como asesoramiento legal.

## 22. Observabilidad e incidentes

- Errores 5xx monitoreados.
- Fallos de webhook Mercado Pago monitoreados.
- `payment.mismatch` visible para soporte/operaciones.
- Print jobs `failed` y `processing` trabados visibles.
- Intentos fallidos de admin/rate-limit spikes observables.
- Logs no contienen secretos.
- Existe un canal/procedimiento para incidente: contener, rotar secretos, preservar evidencia, comunicar y recuperar.
- Sentry/u otra observabilidad configurada si forma parte del stack del entorno.

## 23. Smoke tests mínimos post-deploy

Ejecutar contra un entorno seguro representativo. Adaptar dominio/origin; no usar ejemplos literalmente si apuntan a producción.

Esperar, como mínimo:

- catálogo válido → `200`;
- pedido inexistente → `404` controlado, no `500`;
- storefront origin contra `/api/v1/admin/*` → `403 INVALID_ORIGIN`;
- creación de pedido → `201`;
- retry idéntico con misma key → `200` + mismo `order.id`/número;
- misma key + checkout distinto → `409 IDEMPOTENCY_CONFLICT`;
- payload/origin inválidos → error controlado;
- si MP está habilitado: smoke sandbox completo;
- si PrintNode está habilitado: prueba física;
- si Commerce está habilitado: login admin, edición, pedido, cancelación y stock.

No crear pedidos, cobros, refunds ni impresiones reales en producción sin confirmación explícita del usuario.

---

# Riesgos conocidos post-Bagdad que la skill debe recordar

Aunque todo lo demás pase, revisar siempre estos puntos y marcar su estado actual:

1. CSP todavía puede usar `unsafe-inline`.
2. Admin Commerce cross-domain / `SameSite=None`.
3. Rol Commerce puede persistir en cookie hasta expirar.
4. Falta dispatcher periódico de PrintNode para jobs `failed`.
5. Cancelar pedido MP pagado no implica automáticamente refund de negocio.
6. Stock Food sigue viviendo en JSON del catálogo; puede generar conflictos de revisión con alto volumen/admin de edición.
7. Commerce `card` no debe presentarse como pago real si no hay gateway implementado.
8. Seed de Vera Studio sigue dentro de `0002` si no fue separado posteriormente.
9. `listOrders` necesita paginación real antes de alto volumen.
10. Rate limit basado en `X-Forwarded-For` depende de proxy confiable.
11. Refresh concurrente de token Mercado Pago debe revisarse si aparecen carreras reales.
12. Probar Mercado Pago sandbox y PrintNode físico sigue siendo obligatorio antes de confiar en esos límites externos.

Si el repo cambió y alguno ya fue resuelto, verificarlo con evidencia y marcar ✅; no repetirlo como deuda por memoria.

---

# Comandos seguros sugeridos

Usarlos sólo cuando correspondan al entorno y estén disponibles.

```bash
git status --short
git log --oneline -5
git diff --check
npm run typecheck
npm test
npm run build
npx supabase migration list
npx supabase db push --dry-run
```

Para secret scanning, si la herramienta está instalada/configurada:

```bash
gitleaks detect --source . --redact
```

No instalar herramientas, modificar dependencias ni ejecutar scans que suban código a terceros sin consentimiento.

Para SQL de auditoría, preferir queries **read-only**. Ejemplos conceptuales:

```sql
-- RLS activo
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- privilegios de anon/authenticated
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;

-- policies existentes: informativo en el modelo server-only; cero policies NO implica falla por sí sola
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

---

# Gate de producción

## Bloquear lanzamiento / dinero real (P0) si existe cualquiera de estos

- Fuga o acceso cross-tenant.
- `service_role` o secreto crítico expuesto al navegador/repositorio/logs.
- `NADAV_CORE_DEMO_MODE=true` en producción.
- Precios/totales/stock aceptados desde cliente sin revalidación server-side.
- Idempotencia rota con posibilidad de duplicar pedidos/cobros.
- Admin accesible desde origen no autorizado o sin autenticación efectiva.
- Mercado Pago real habilitado sin validación server-to-server de pago/monto/merchant/referencia.
- Commerce ofrece `card` como cobro real sin procesamiento real.
- Migraciones críticas requeridas no aplicadas en la base objetivo.

## Puede lanzar con ⚠️ sólo si

- El riesgo no compromete aislamiento, dinero, autenticación o integridad inmediata.
- Está documentado.
- Tiene responsable y fecha.
- Existe mitigación operacional razonable.

---

# Formato de salida

Entregar primero una tabla compacta:

| Área | Estado | Severidad | Evidencia | Acción |
|---|---|---|---|---|
| Aislamiento Supabase | ✅/⚠️/❌ | —/P0/P1… | evidencia concreta | acción breve |

Después incluir únicamente:

### Bloqueantes antes de producción
Lista corta de P0. Si no hay: `Ninguno encontrado con la evidencia disponible.`

### Riesgos altos / pendientes
P1 y controles no verificables relevantes.

### Riesgos conocidos post-Bagdad
Sólo los que sigan vigentes según evidencia actual.

### Verificaciones ejecutadas
Comandos/tests/smoke tests realmente corridos. No listar pruebas que sólo fueron recomendadas.

### Veredicto
Elegir uno:

- **APTO para continuar a producción con la evidencia verificada.**
- **APTO CON PENDIENTES**, enumerando los P1/P2 aceptados.
- **NO APTO**, enumerando los P0.

No decir "100% seguro" ni equivalentes.

---

# Mejora continua

Cuando una vulnerabilidad, incidente o near-miss real revele un control faltante:

1. resolver el problema en producto/infraestructura;
2. agregar un test automatizado cuando sea posible;
3. agregar o actualizar el item correspondiente de esta skill;
4. documentar cómo verificarlo;
5. evitar reglas ligadas a personas o nombres de clientes concretos si el control puede expresarse como principio general.
