# Acta de auditoría — Housekeeping de la cola push (JUA-127 + JUA-128) · v1

Fecha: 2026-07-17
Commit candidato: `cfde304` sobre `ff9f3a8` (base productiva `6cb7dda`).
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Origen: OBS-4 diferidas del ciclo JUA-33 (dictámenes v2/v3), ahora como JUA-127 y JUA-128.

--------------------------------------------------------------------

## JUA-127 — Poda de suscripción muerta por fallos de red consecutivos

**El problema:** una suscripción permanentemente inalcanzable falla con `statusCode` indefinido (error de
red, no 404/410). El emisor lo trataba como fallo transitorio y la reintentaba indefinidamente, sin borrar
nunca la fila muerta (solo 404/410 la borraban).

**La solución:**
- Esquema: `pushSubscriptions.fallosRed` (opcional; ausente = 0).
- `enviarAUsuario` (`pushEnvio.ts`): ante un fallo **sin código HTTP**, llama a `push.contarFalloRed`, que
  incrementa `fallosRed`; al **3.º consecutivo** poda la suscripción (la borra) y devuelve `podada:true`.
  - Podada → cuenta como **caducada** (no provoca un reintento inútil de la notificación).
  - Aún no podada → **fallida** (transitorio: la notificación reintenta con backoff).
- Un envío con **éxito** reinicia el contador (`push.resetFalloRed`, solo si venía > 0 — evita escrituras).
- Ambas mutaciones son **condicionales por `id + usuarioId + p256dh`**: no actúan sobre una fila reasignada
  a otro usuario ni con claves rotadas (misma defensa que `borrarSubCaducada`).

**Semántica:** "consecutivos" — un envío con éxito reinicia, así que una sub intermitente nunca se poda;
solo una **persistentemente muerta** acumula 3 y se elimina (a lo largo de varios flujos).

## JUA-128 — Reclamar por rango indexado (escala)

**El problema:** `reclamarLote` traía **todas** las pendientes (`por_estado`) y filtraba
`proximoIntento <= ahora` en memoria; recorre toda la partición del estado en cada pasada del cron.

**La solución:**
- Índice `notificacionesPush.por_estado_intento` `[estado, proximoIntento]`.
- `reclamarLote` reclama por **rango**: `.eq("estado","pendiente").lte("proximoIntento", ahora).take(LOTE_MAX)`
  — acotado, sin recorrer toda la partición. (`encolarClienteFrio` y el reintento **siempre** fijan
  `proximoIntento`, así que el rango cubre todas las pendientes elegibles.)
- La **recuperación de leases** (estado `enviando` por `leaseHasta`) se mantiene por `por_estado`: es un
  conjunto **acotado** (solo las que están en vuelo), no crece con el backlog. Se documenta la decisión.

## Verificación (dev)

- **JUA-127 — driver-41 (6/6):** `reporte-poda-sub-dev.txt`. 2 fallos → no poda (`fallosRed=2`); un éxito
  reinicia (`fallosRed=0`); tras reiniciar, 2 fallos → sigue sin podar; **3.º consecutivo → poda** (sub
  eliminada); `contarFalloRed` **no actúa** si el `p256dh` no coincide. Sub fake de dev, limpiada.
- **JUA-128 — driver-42 (3/3):** `reporte-indice-cola-dev.txt`. `proximoIntento` **futuro → excluido** del
  reclamo (sigue pendiente); **pasado → incluido** (pasa a `enviando`). Datos demo restaurados.
- **Regresión — driver-36 (7/7):** `reclamarLote` (reclamo/descartes/redirección por audiencia) sigue
  correcto con el índice nuevo.

```txt
npx tsc --noEmit  OK    npx eslint  OK    npm run build  OK    convex dev --once  OK (índice por_estado_intento)
```

## Notas

- Sin cambios de comportamiento observable en JUA-128 (mismas filas reclamadas; solo cambia el acceso a
  índice). JUA-127 sí cambia el resultado ante una sub muerta (antes churn infinito; ahora se poda tras 3).
- `_generated` sin cambios (funciones nuevas en módulo existente + índice/campo no alteran `api.d.ts` /
  `dataModel.d.ts`).

## Constancia

Cambios en `convex/{schema,notificaciones,push,pushEnvio}.ts`. No desplegado, sin `git push`, sin tocar
prod/remoto. El despliegue registra el índice nuevo y el campo opcional (sin migración).
