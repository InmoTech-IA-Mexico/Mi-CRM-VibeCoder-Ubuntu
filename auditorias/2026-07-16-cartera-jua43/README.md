# Cartera por vendedor (JUA-43) — ciclo de auditoría y despliegue

**Fecha:** 2026-07-16
**Resultado:** NO-GO (v1) → **GO CON OBSERVACIONES** (v2) → **DESPLEGADO Y VERIFICADO EN VIVO**
**Commits:** `e75d2bd` (feature) + `24ba21e` (remediación B-1..B-5) + `aab2af2` (obs. OBS-1)
**Base productiva previa:** `b1a2c41`

## Qué se entregó

Asignación de clientes por vendedor: cada **operativo** ve y gestiona solo los clientes de los que
es responsable; **Marta (admin)** ve todos (con toggle "Mis clientes / Todos"); un cliente sin
responsable queda en un pool "sin asignar" visible solo para el admin; el **observador** (JUA-42)
ve todo (rol de lectura global, sin cartera). El enforcement es **en servidor**, no por ocultar en UI.

## Historia del ciclo

1. **v1 (`e75d2bd`) → NO-GO.** El check de cartera cubría las mutaciones que reciben `clienteId`
   directo, pero dejaba 5 huecos en funciones sobre recursos existentes y agregados:
   - **B-1** oportunidades (`cambiarEtapa`/`eliminar`), **B-2** seguimientos de cliente
     (`reprogramar`/`cancelar`/`eliminar`/`marcarSeguimientoRealizado`), **B-3**
     `sincronizarInactividad`, **B-4** `buscarDuplicado`, **B-5** `estadoGlobal`.
2. **v2 (`24ba21e`) → GO con observaciones.** Los 5 resueltos con `verificarCartera`/`esDeCartera`
   en todas las funciones públicas. Además, migración de seguimientos pendientes al reasignar la
   cartera entre responsables (para no dejarlos huérfanos), con defensa en profundidad conservada.
3. **OBS-1 (`aab2af2`).** Se acotó el claim de la migración al traspaso *entre responsables* (el
   caso "pool → dueño" no migra a propósito: lo gestiona el admin). Sin cambio de conducta.

## Manejo de observaciones (dictamen v2)

- **OBS-1** — aplicado (`aab2af2`).
- **OBS-2** — agregados globales (`etiquetas.listar`, `usuarios.equipo`) → seguimiento en **JUA-126**.
- **OBS-3** — driver de servidor endurecido (fixture dentro de `try/finally` + aserción positiva
  B-3+). Limitación documentada: una transición positiva a "inactivo" 100 % determinista exigiría
  antedatar datos, imposible por API pública.
- **OBS-4** — esta carpeta (evidencia versionada).

## Verificación

- **Dev — servidor:** 14/14 PASS (`drivers/driver-23-cartera-servidor.js`,
  `reporte-cartera-servidor-dev.txt`). Dos operativos, cliente ajeno, migración y defensa en profundidad.
- **Dev — UI E2E:** 13/13 PASS, 0 errores de navegador (`drivers/driver-22-cartera.js`,
  `reporte-cartera-ui-dev.txt`).
- **Producción (glad-bird-297) — en vivo:** 13/13 PASS con un 2º operativo QA revocable
  (`drivers/verif-prod-cartera-jua43.py`, `reporte-prod-cartera-jua43.txt`). QA revocado y fixtures
  eliminados al terminar.

## Despliegue

Orden: `npx convex deploy` → `glad-bird-297` **primero**; luego `git push origin main` → Railway
reconstruyó el frontend (deploy `SUCCESS` de `aab2af2`). Esquema sin cambios (`responsableId` ya
existía en el MVP). Verificación en vivo posterior en verde.

## Archivos

- `auditoria-produccion-cartera-jua43-v1.md` / `-v2.md` — actas entregadas a auditoría.
- `dictamen-cartera-vendedor-jua43-e75d2bd-no-go-v1.md` — dictamen NO-GO (B-1..B-5).
- `dictamen-cartera-vendedor-jua43-24ba21e-go-v2.md` — dictamen GO con observaciones.
- `drivers/` — drivers (dev servidor/UI + prod en vivo) y sus reportes sanitizados (sin tokens ni
  contraseñas; credenciales por variable de entorno).
