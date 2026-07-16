# Acta para dictamen — Seguimiento post-venta automático (JUA-37) · v1

Fecha: 2026-07-15
Commit candidato: `8032984` (sobre prod actual `338e28c`)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Alcance (JUA-37, proyecto "Resto del PRD")

Al marcar una oportunidad como **Ganada**, el sistema crea automáticamente un recordatorio de
seguimiento **15 días después** (el umbral del PRD) para ofrecer el siguiente producto, sin que Carlos
tenga que acordarse de crearlo.

--------------------------------------------------------------------

## Cambios (3 archivos, +79 −4) — solo backend, sin UI nueva

**`convex/oportunidades.ts`** — en `cambiarEtapa`, sobre las TRANSICIONES hacia/desde Ganada:
- **→ Ganada:** `programarPostVenta` inserta un seguimiento con
  · título "Seguimiento post-venta: {nombre de la oportunidad}"
  · descripción "Han pasado 15 días desde el cierre de {nombre}. Es el momento de contactar al
    cliente para ofrecerle el siguiente producto."
  · fecha = hoy (en el **calendario del negocio**, JUA-28) + 15 días, medianoche local, sin hora
  · responsable = **quien cierra la venta** · prioridad media · una vez · vinculado a la oportunidad
  · marca `origen: "post_venta"`.
  **Sin duplicados:** si esa oportunidad ya tiene un post-venta pendiente, no se re-crea.
- **Sale de Ganada** (reabrir / perdida / cancelada): `cancelarPostVenta` cancela el post-venta que
  siga **pendiente** (los realizados no se tocan). Coherente con la limpieza de motivos de JUA-122.
- **`eliminar` oportunidad** también cancela su post-venta pendiente (evita recordatorios huérfanos).

**`convex/schema.ts`** — campo opcional `origen: "post_venta"` en `seguimientos` (aditivo, solo lo
escribe el sistema; permite no duplicar y cancelar). No toca `src/lib/enums.ts`: no es un catálogo de
dominio visible para el usuario.

**`eslint.config.mjs`** — ignora `tmp/**` (los drivers de QA archivados por la OBS-3 del dictamen
anterior usan `require()` y rompían el lint del proyecto; `tmp/` está fuera de git y no es código de
la app).

El recordatorio creado es un seguimiento **normal**: aparece en la agenda del día correspondiente
(JUA-23), en la ficha, y se edita/reprograma/cancela con la gestión existente (JUA-24, responsable o
admin). Por eso no hay UI nueva.

--------------------------------------------------------------------

## Decisiones de alcance (para tu revisión)

- **Cancelación automática al des-ganar:** la spec solo pide que sea cancelable a mano; añadí que al
  salir de Ganada el post-venta pendiente se cancele solo (una venta des-marcada no debería dejar un
  aviso de "ofrecer el siguiente producto"). Si se vuelve a ganar, se crea uno nuevo.
- **"Responsable que cerró" = quien ejecuta el cambio de etapa** (no el `responsableId` de la
  oportunidad, que es opcional y puede estar vacío en datos reales).
- **Fecha sin hora** (recordatorio de día completo, como los de "todo el día" existentes).
- **Solo transiciones:** re-guardar Ganada sobre una ya ganada (p. ej. editar la nota de cierre) no
  crea nada.

--------------------------------------------------------------------

## Verificación ejecutada (0 errores)

```txt
npx eslint .           OK (tras ignorar tmp/)
npx tsc --noEmit       OK
npm run build          OK
npx convex dev --once  OK (schema aditivo aceptado)
```

**Funcional servidor (CLI sobre dev, oportunidad "Oportunidad B JUA-32", sesión de Marta):**
- Ganada → seguimiento creado: `origen post_venta`, pendiente, destino cliente, vinculado a la
  oportunidad, responsable Marta, prioridad media, título y descripción exactos. **PASS**
- `fecha = 1785391200000` = **30 de julio de 2026, 00:00 América/Ciudad de México** (hoy 15-jul + 15
  días, medianoche del negocio — no UTC). **PASS**
- Re-marcar Ganada (ya ganada) → sigue habiendo exactamente 1 pendiente (sin duplicado). **PASS**
- Volver a "nueva" → 0 pendientes, 1 cancelado. **PASS**

**Funcional UI (driver Playwright, dev, 390×844): 2/2 PASS**
- Marta abre la ficha → oportunidad → etapa **Ganada** → "Guardar cambio" (flujo JUA-122 con
  celebración) → la ficha muestra **"Seguimiento post-venta: Oport…" con fecha 30 jul** en
  "Seguimientos pendientes", con su menú "⋮" de gestión (editar/cancelar). Captura:
  `tmp/capturas-jua37/d9-postventa-ficha.png`.
- Al revertir la etapa por CLI, el recordatorio creado desde la UI también quedó **cancelado**
  (verificado en datos) — segundo ciclo completo; además prueba que tras una cancelación previa,
  volver a ganar crea un recordatorio nuevo.

Driver archivado en `tmp/drivers-jua37/driver-9-postventa.js`. Residuo QA en dev: 2 seguimientos
post-venta cancelados de "Oportunidad B JUA-32" (que volvió a su etapa original "nueva").

**No verificado en vivo** (requiere esperar 15 días): que el recordatorio aparezca en la agenda **ese
día** — la agenda se alimenta de `fecha` con lógica ya auditada (JUA-23/24); la fecha quedó verificada
al milisegundo.

--------------------------------------------------------------------

## Si el dictamen es GO

Con tu OK explícito: `npx convex deploy` (cambio solo de backend; aditivo, sin ventana de
incompatibilidad) → `git push` (Railway; el frontend no cambió) → verificación en vivo (ciclo
ganar/des-ganar en el cliente QA del demo) → JUA-37 Done en Linear + comentario → archivar acta →
actualizar `tmp/estado-produccion.md`.
