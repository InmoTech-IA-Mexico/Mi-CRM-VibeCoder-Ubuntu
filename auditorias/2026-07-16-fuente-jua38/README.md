# Fuente de contacto (JUA-38) — ciclo de auditoría y despliegue

**Fecha:** 2026-07-16
**Resultado:** **GO CON OBSERVACIONES** (v1) → **DESPLEGADO Y VERIFICADO EN VIVO**
**Commits:** `2a13acf` (feature) + `a5b951c` (obs. OBS-1: aria-pressed)
**Base productiva previa:** `5a95052`

## Qué se entregó

Campo **"Fuente de contacto"**: el origen específico de cómo llegó el cliente (más granular que el
"canal" del MVP), como **categoría** (referido / campaña / evento / visita / otro) **+ detalle libre
opcional**. Opcional en la ficha, filtrable en la lista, y **fuera del alta rápida** (no rompe el flujo
mínimo) — los tres criterios de aceptación de JUA-38.

- **Datos:** `clientes.fuenteTipo` + `fuenteDetalle`, ambos **opcionales** (sin migración).
- **Backend:** reglas de servidor en `clientes.actualizar` (detalle solo con tipo; acotado a 120).
  **Sin nueva superficie de autorización** — reutiliza `actualizar`, ya protegida por cartera (JUA-43)
  y solo-escritura (JUA-42).
- **UI:** fila en la ficha, selector (5 categorías + detalle) en edición, chips de filtro dinámicos
  en la lista.

## Manejo de observaciones (dictamen v1)

- **OBS-1** — `aria-pressed` en los selectores de fuente y canal → aplicado (`a5b951c`).
- **OBS-2** — driver de negativas de servidor → `drivers/driver-26-fuente-servidor.js` (dev 6/6).
- **OBS-3** — driver UI endurecido (restauración en `finally`, esperas por elemento) → `driver-25`.
- **OBS-4** — esta carpeta (evidencia versionada).

## Verificación

- **Dev — UI E2E:** 11/11 PASS, 0 errores de navegador (`reporte-fuente-dev.txt`).
- **Dev — servidor:** 6/6 PASS (detalle-sin-tipo, recorte 120, tipo inválido, observador, cartera) —
  `reporte-fuente-servidor-dev.txt`.
- **Producción (glad-bird-297) — en vivo:**
  - Backend `--prod`: 4/4 (lógica nueva) — `reporte-fuente-servidor-prod.txt`.
  - UI E2E contra la URL de Railway con cliente QA: 11/11, 0 errores — `reporte-fuente-ui-prod.txt`.
  - Cliente QA eliminado; prod verificado sin residuales (equipo original, 9 clientes).

## Incidente de despliegue (lección)

El `convex deploy` de prod se reportó como exitoso **dos veces sin haber empujado el código** (el
validador de `clientes.actualizar` en prod seguía sin los campos de fuente). Se detectó en la
verificación en vivo: una llamada real devolvía `ArgumentValidationError: extra field fuenteDetalle`.
Como el **frontend sí se había desplegado** (Railway `a5b951c`), prod quedó temporalmente
**desalineado** (seleccionar una fuente al editar fallaba; editar sin fuente seguía bien).

**Corrección:** re-deploy real de Convex, verificado esta vez por la salida completa
(`Uploading functions… Pushing code… Schema validation complete… Deployed`) y confirmado con una
llamada en vivo. **Lección:** tras `convex deploy`, **verificar contra prod que el cambio existe**
(functionSpec o una llamada real) — no basta el mensaje "Deployed". El orden Convex→frontend solo
protege si el push de Convex realmente ocurrió.

## Archivos

- `auditoria-produccion-fuente-jua38-v1.md` — acta entregada a auditoría.
- `dictamen-fuente-jua38-2a13acf-go-v1.md` — dictamen GO con observaciones.
- `drivers/` — driver UI (`driver-25`) y de servidor (`driver-26`) + reportes sanitizados (dev y prod).
- `capturas/` — edición · ficha · filtro.
