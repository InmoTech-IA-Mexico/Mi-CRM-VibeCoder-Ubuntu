# Acta para dictamen — Cartera por vendedor (JUA-43) · v2 (remediación NO-GO)

Fecha: 2026-07-16
Commit candidato: `24ba21e` (remediación) sobre `e75d2bd` (feature v1); prod actual `b1a2c41`
Estado: remediado y verificado en local + dev de Convex. **NO desplegado.**
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Origen: dictamen v1 = NO-GO

La v1 aplicó el check de cartera a las mutaciones que **reciben `clienteId` directo**, pero dejó
5 huecos en funciones que operan sobre **recursos ya existentes** (oportunidad/seguimiento) o sobre
**agregados del negocio**. Un operativo podía, sobre un cliente que NO es de su cartera:

| # | Hueco (v1) | Remediación (v2) |
|---|---|---|
| **B-1** | `oportunidades.cambiarEtapa` / `eliminar` no revalidaban cartera | `oportunidadEditable(ctx, id, sesion)` ahora recibe la sesión y llama `verificarCartera` sobre el cliente padre. Ambos call-sites actualizados. |
| **B-2** | seguimientos de cliente (`reprogramar`/`cancelar`/`eliminar`/`marcarSeguimientoRealizado`) se validaban solo por *responsable del seguimiento*, no por cartera del cliente | `seguimientoGestionable` e `inicio.marcarSeguimientoRealizado` revalidan la cartera del cliente además del responsable. |
| **B-3** | `clientes.sincronizarInactividad` transicionaba clientes ajenos | Filtra a la cartera propia (`esDeCartera`) antes de transicionar. La transición global del negocio la garantiza el cron (no cambia). |
| **B-4** | `clientes.buscarDuplicado` revelaba nombre/tel/email de un cliente ajeno | `esDeCartera` en el predicado de búsqueda: el operativo solo detecta duplicados de su cartera. |
| **B-5** | `inicio.estadoGlobal` agregaba métricas del negocio completo para el operativo | Colección base filtrada por `esDeCartera`; **todos** los agregados (total, por estado, oportunidades, seguimientos) derivan de ella. |

--------------------------------------------------------------------

## Corrección de diseño adicional: seguimientos huérfanos

Al cerrar B-2 apareció un efecto: si Marta reasigna un cliente a otro vendedor, sus seguimientos de
cliente pendientes seguían con el responsable anterior, que **pierde acceso por cartera** → quedaban
"huérfanos" (solo gestionables por admin).

**Fix:** `clientes.asignarResponsable`, al reasignar a un **nuevo** responsable, migra los
seguimientos de cliente **pendientes** que eran del dueño anterior al nuevo. Así la cartera y sus
recordatorios viajan juntos. No toca los que un admin hubiera delegado a un tercero (responsable ≠
dueño anterior), ni los de destino "empleado". El check de cartera en `seguimientoGestionable` se
mantiene como **defensa en profundidad** (bloquea a un responsable que perdió la cartera por
cualquier otra vía).

--------------------------------------------------------------------

## Barrido de cobertura (toda función pública que toca datos de cliente)

Revisadas las 15+ funciones públicas de `clientes/inicio/oportunidades/seguimientos/notas/ventas/
exportaciones`. Cada una queda:

**Restringida por cartera (operativo):** `clientes.listar/detalle/cambiarEstado/cambiarPrioridad/
cambiarEtiquetas/actualizar/buscarDuplicado/sincronizarInactividad`; `inicio.agendaDelDia/
panelInactividad/marcarSeguimientoRealizado/estadoGlobal`; `oportunidades.crear/cambiarEtapa/
eliminar`; `seguimientos.crear/reprogramar/cancelar/eliminar`; `notas.crear`; `ventas.crear`.

**Solo admin (ve todo el negocio por diseño — no expone datos de cartera a un operativo):**
`clientes.asignarResponsable/papelera/restaurar/eliminarDefinitivo/vaciarPapelera`;
`oportunidades.reporteMensual`; `seguimientos.panelSupervision`; `notas.eliminar`; `ventas.resumen`;
`exportaciones.solicitar` (el volcado CSV completo es capacidad admin).

Conclusión del barrido: **no quedan funciones que revelen o dejen escribir datos de un cliente ajeno
a un operativo.** No se encontraron B-6/B-7.

--------------------------------------------------------------------

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npx convex dev --once  OK (funciones listas)
```

**Driver de negativas de servidor — 13/13 PASS** (dos operativos QA, cliente ajeno; defensa en
profundidad; reporte sanitizado sin tokens ni contraseñas) — `tmp/drivers-jua43/driver-23-cartera-servidor.js`:

```txt
PASS — B-1: cambiarEtapa de oportunidad ajena → No encontrado
PASS — B-1: la etapa de la oportunidad NO cambió (sigue 'nueva')
PASS — B-2a: Carlos reprograma/marcaRealizado/elimina seguimiento de cliente ajeno → bloqueado (x3)
PASS — B-2b: vendedor2 (nuevo dueño) reprograma y cancela el seguimiento MIGRADO → OK (x2)
PASS — B-2c: Carlos (responsable de un seguimiento delegado por admin sobre cliente ajeno)
             → bloqueado por cartera en cancelar y marcaRealizado (x2)  ← defensa en profundidad
PASS — B-3: sincronizar (Carlos) NO cambia estados de la cartera de vendedor2
PASS — B-4: buscarDuplicado de cliente ajeno → null para Carlos; vendedor2 (dueño) SÍ ve su duplicado
PASS — B-5: estadoGlobal de Carlos (9) < admin (17) — solo su cartera
```

**Driver UI E2E — 13/13 PASS + 0 errores de navegador** (390×844, credenciales por env) —
`tmp/drivers-jua43/driver-22-cartera.js`: toggle Todos(16)/Mis clientes(7); ficha con selector;
Ana "Vendedor Dos" → **reasignada a Carlos**; vendedor2 pierde a Ana (lista y ficha por URL →
"no encontrado"); Carlos gana a Ana, sin selector, responsable en lectura.

Reportes durables: `tmp/drivers-jua43/reporte-cartera-servidor-dev.txt` y `...-ui-dev.txt`.

--------------------------------------------------------------------

## Datos QA (dev)

- 2º operativo QA `vendedor2.qa@test.mx` (operativo, dev) — para las negativas con dos vendedores.
- Fixtures del driver de servidor: creados y **eliminados** en cada corrida (cliente + oportunidad +
  seguimientos, borrado en cascada). Ana **restaurada a "sin asignar"** tras el E2E (estado previo).

--------------------------------------------------------------------

## Cambios de esta remediación (commit `24ba21e`)

`convex/oportunidades.ts` (B-1) · `convex/seguimientos.ts` (B-2) · `convex/inicio.ts` (B-2/B-5) ·
`convex/clientes.ts` (B-3/B-4 + migración de seguimientos). Sin cambios de esquema ni de UI
(el `responsableId` ya existía; la UI de v1 no cambia).

## Si el dictamen es GO

`npx convex deploy` (funciones; schema sin cambios) → `git push` → Railway → verificación en vivo
en prod (2º operativo QA: aislamiento lectura/escritura sobre oportunidad/seguimiento ajenos +
duplicado + estadoGlobal + migración al reasignar; revocar el QA al terminar) → JUA-43 Done +
comentario → copiar evidencia a `auditorias/2026-07-16-cartera-jua43/`.
