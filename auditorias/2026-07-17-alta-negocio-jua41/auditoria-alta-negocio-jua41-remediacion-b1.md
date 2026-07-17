# Acta de remediación — Alta automatizada de negocio (JUA-41) · B-1 + OBS

Fecha: 2026-07-17
Commit candidato: `6cb7dda` sobre `94342f9` (base productiva `6a693cc`).
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Referencia: dictamen JUA-41 v1 = **NO-GO** por B-1 (onboarding inicial sin ruta de recuperación) + OBS-1/2/3.
Veredicto propuesto: **bloqueante remediado; se solicita revisión.**

--------------------------------------------------------------------

## B-1 — El alta inicial ahora es recuperable sin tocar la BD → REMEDIADO

**El defecto (confirmado):** tras `crearNegocio`, el primer admin podía quedar pendiente de forma
irrecuperable por CLI: (1) la invitación expira a los 7 días; (2) se capturó un email equivocado; (3) otra
cuenta toma ese email antes de activar y `invitaciones.activar` la rechaza. `usuarios.reenviar` exige una
sesión admin **inexistente** en ese estado, y `crearNegocio` rechaza siempre un `emailAdmin` ya presente.
Sin salida, el equipo volvería a editar/borrar registros a mano — justo lo que JUA-41 elimina.

**La remediación (`6cb7dda`):**

- **`reemitirAdminInicial(negocioId, emailAdmin?, baseUrl?)`** (`internalMutation`):
  - **Solo** opera si el negocio **no** tiene admin activo (si lo tiene → rechaza).
  - Resuelve el email destino (el corregido si se pasa, o el actual) y **revalida la unicidad global**
    (`usuarios.por_email` + `negocios.por_email_admin`, excluyendo el propio negocio) — cubre el caso de
    email tomado por otra cuenta.
  - **Invalida** las invitaciones admin pendientes del negocio (`estado → expirada`): el token viejo deja
    de servir, y no quedan invitaciones pendientes **paralelas**.
  - **Corrige** `negocios.emailAdmin` si se pasó uno nuevo.
  - Crea una **invitación de un solo uso** (7 días) y devuelve el enlace nuevo. El token no se registra en
    reportes/logs (solo se devuelve al operador).
- **`cancelarNegocioVacio(negocioId)`** (complemento): borra un negocio **sin usuarios ni clientes** (alta
  equivocada/duplicada) con sus invitaciones pendientes. **Nunca** borra uno con datos.

## Evidencia dinámica — driver-38 (10/10, incl. la aserción de limpieza), mapeada a lo exigido

Reporte `tmp/drivers-jua41/reporte-recuperacion-b1-dev.txt`; negocios de prueba (`@test.mx`) **borrados**; sin secretos.

| Exigido por el dictamen | Prueba | Resultado |
|---|---|---|
| Expiración/invalidación de la primera invitación | **R1** | el token viejo pasa a `expirada`; solo el nuevo queda `pendiente` |
| Reemisión | **R1/R2** | nueva invitación válida (`porToken` → `pendiente`/admin) |
| Cambio de correo | **R2** | `emailAdmin` del negocio corregido; invitación para el correo nuevo |
| Rechazo con admin activo | **R3** | `reemitirAdminInicial` rechaza si ya hay admin activo |
| Ausencia de invitaciones pendientes paralelas | **R1/R2** | tras reemitir, las anteriores quedan `expirada`; solo una `pendiente` |
| (extra) Unicidad revalidada al reemitir | **R4** | rechaza email ya tomado; recupera con email libre |
| (extra) Cancelación segura | **R5** | borra un negocio vacío; rechaza uno con usuarios |

Regresión del flujo nominal: **driver-37 10/10** (creación, listado, guards, activación real).

> Nota (OBS-1 v2): R1 documenta la **invalidación** de la primera invitación (la reemisión la marca
> `expirada`); la ruta de código no depende del estado previo, por lo que cubre igual una invitación
> vencida por tiempo. Marcar una invitación como `expirada` para documentar el caso literal del vencimiento
> queda como prueba futura opcional (no altera el comportamiento).

## Observaciones no bloqueantes — atendidas

- **OBS-1:** `zonaHoraria` se valida como zona **IANA** (`Intl.DateTimeFormat`, lanza en zona inválida) y
  `baseUrl` se exige **https**. Verificado (driver-38: rechaza zona inválida y `http://`).
- **OBS-2:** nuevo índice **`negocios.por_email_admin`**; la unicidad y el listado lo usan en vez de `filter`.
- **OBS-3:** `qaBorrarNegocio` ahora **solo** borra negocios de prueba (`emailAdmin` termina en `@test.mx`),
  además del gate `QA_HELPERS`; no puede tocar el demo ni un negocio real.

## Verificación estática

```txt
npx tsc --noEmit  OK    npx eslint  OK    npm run build  OK (25 rutas)    convex dev --once  OK (índice nuevo)
```

## Constancia

Cambios en `convex/negocios.ts` + índice en `convex/schema.ts`; sin frontend. No desplegado, sin `git push`,
sin tocar prod/remoto. El helper QA queda inerte en prod (`QA_HELPERS` ausente).
