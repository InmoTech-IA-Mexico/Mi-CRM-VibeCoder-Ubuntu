# Visibilidad de agregados por cartera (JUA-126) — ciclo de auditoría y despliegue

**Fecha:** 2026-07-16
**Resultado:** NO-GO (v1) → **GO CON OBSERVACIONES** (v2) → **DESPLEGADO Y VERIFICADO EN VIVO**
**Cadena de commits (obs. OBS-1 del dictamen v2):** `2e92576` (política backend) → `400324f`
(documentación del incidente JUA-38, sin código) → `1bbeb9c` (remediación UI del NO-GO).
**Base productiva previa:** `7dfa2aa`

## Qué se entregó (origen: OBS-2 del dictamen de JUA-43)

Dos queries devolvían **métricas agregadas de todo el negocio a un operativo**. Política aplicada:

- `etiquetas.listar` — el nº de clientes por etiqueta se limita a la **cartera** del operativo (con
  `esDeCartera`); admin y observador cuentan el negocio completo. Corrige además la inconsistencia de
  que el chip mostraba un total global mientras el filtro solo la cartera.
- `usuarios.equipo` — la **carga por miembro** solo se expone al **admin**; operativo y observador
  reciben la lista (nombres/roles) con `clientes: null`.

## Historia del ciclo

1. **v1 (`2e92576`) → NO-GO.** Política de servidor correcta, pero al pasar `equipo…clientes` a `null`
   para no-admin, el flujo operativo de **tarea personal** en `/seguimientos/nuevo` mostraba
   `Operativo · null clientes` (interpolar `null` en plantilla es válido en JS → ni tsc ni build lo
   veían). El acta v1 afirmó "sin cambios de UI", lo cual era incorrecto.
2. **v2 (`1bbeb9c`) → GO con observaciones.** `subtituloMiembro` (programar-seguimiento) y el subtítulo
   del selector de responsable **omiten el conteo cuando `clientes == null`** (solo el rol); se conserva
   la cifra para el admin. Búsqueda exhaustiva de consumidores de `equipo…clientes` → solo esos dos.
   Se atendieron además OBS-1 (toda la preparación del driver dentro de `try/finally`) y OBS-2
   (aserción explícita de que el observador también recibe `null`).

## Verificación

- **Dev — UI E2E:** 5/5 PASS, 0 errores (`drivers/driver-28-agregados-ui.js`, `reporte-agregados-ui-dev.txt`).
- **Dev — servidor:** 5/5 PASS (operativo/observador sin carga, admin con carga; etiqueta cartera=1 vs
  negocio=2) — `drivers/driver-27-agregados-servidor.js`, `reporte-agregados-dev.txt`.
- **Producción (glad-bird-297) — en vivo:**
  - Contrato: `usuarios:equipo --prod` → operativo `null` en todos, admin cargas `[0, 9]`.
  - UI E2E contra la URL de Railway: 5/5 PASS, 0 errores — `reporte-agregados-ui-prod.txt` (sin fixtures).

## Despliegue

**Orden frontend-primero** (decisión razonada): por ser un cambio de **valor de retorno** (número→`null`)
con guard retrocompatible en el frontend, se desplegó primero el frontend (`git push` → Railway
`SUCCESS` de `1bbeb9c`) para que el guard estuviera vivo, y **después** Convex (política backend),
evitando mostrar el "null" transitorio que el orden Convex-primero habría causado en la ventana de
despliegue. Tras Convex, se verificó el contrato contra prod (`usuarios:equipo --prod`) y la UI en vivo.
Sin cambios de esquema.

## Archivos

- `auditoria-produccion-agregados-jua126-v1.md` / `-v2.md` — actas de entrega.
- `dictamen-agregados-cartera-jua126-2e92576-no-go-v1.md` — dictamen NO-GO (B-1).
- `dictamen-agregados-cartera-jua126-1bbeb9c-go-v2.md` — dictamen GO con observaciones.
- `drivers/` — driver de servidor y UI + reportes sanitizados (dev y prod).
- `capturas/` — operativo (sin "null") · admin (con cargas).
