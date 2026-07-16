# Acta para dictamen — Rol Observador / solo lectura (JUA-42) · v1

Fecha: 2026-07-16
Commit candidato: `e363250` (sobre prod actual `f11d868`; app funcional previa `757abc0`)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Alcance (JUA-42)

Tercer rol **Observador** (solo lectura): consulta todas las pantallas del CRM sin poder crear, editar
ni eliminar. Marta lo asigna desde Gestión de usuarios. La seguridad se impone **en el servidor**;
la UI simplemente no muestra los botones de acción.

--------------------------------------------------------------------

## Enforcement en servidor (fuente de verdad) — la parte crítica

Helper nuevo `resolverSesionEscritura(ctx, token)` en `convex/auth.ts`: resuelve la sesión y devuelve
`null` si el rol es `observador`. Las mutaciones ya lanzan "No autorizado" ante `null`, así que el
observador recibe el mismo 403 que una sesión inválida.

**Matriz de las 38 mutaciones del backend** (revisar que ninguna de escritura quede sin proteger):

| Mutación | Protección del observador |
|---|---|
| `clientes.crear / actualizar / cambiarEstado / cambiarPrioridad / cambiarEtiquetas` | `resolverSesionEscritura` → No autorizado |
| `notas.crear` | `resolverSesionEscritura` |
| `oportunidades.crear / cambiarEtapa` | `resolverSesionEscritura` |
| `ventas.crear` | `resolverSesionEscritura` |
| `seguimientos.crear` | `resolverSesionEscritura` |
| `seguimientos.reprogramar / cancelar / eliminar` | helper `seguimientoGestionable` → `resolverSesionEscritura` |
| `inicio.marcarSeguimientoRealizado` | `resolverSesionEscritura` |
| `clientes.enviarAPapelera / restaurar / eliminarDefinitivo / vaciarPapelera` | admin-only (ya rechaza no-admin) |
| `notas.eliminar` · `oportunidades.eliminar` | admin-only |
| `etiquetas.crear / renombrar / eliminar` | admin-only (`sesionAdmin`) |
| `usuarios.invitar / reenviar / desactivar / reactivar` | admin-only (`sesionAdmin`) |
| `exportaciones.solicitar` | admin-only |
| `auth.iniciarSesion / cerrarSesion / tocarSesion / cambiarPassword` | auth propia — el observador gestiona su cuenta |
| `usuarios.actualizarPerfil` | su propio perfil (decisión, ver abajo) |
| `recuperacion.solicitar / restablecer` · `invitaciones.activar` | pre-sesión / público |
| `exportaciones.consumir` | token del enlace (no sesión) |
| `clientes.sincronizarInactividad` | mantenimiento del sistema (ver decisión) |

**15 mutaciones de escritura de datos del negocio** pasan a `resolverSesionEscritura`; el resto ya
bloqueaban al observador (admin-only) o son auth/propias/públicas.

## UI (los botones no existen para el observador — "directamente no existen")

Helpers en `use-sesion.ts`: `usePuedeEditar()` (rol ≠ observador) y `useGuardEscritura()` (redirige
a `/inicio`). Ocultos para observador:
- **FAB global** (nuevo cliente / seguimiento / venta) — `marco-app.tsx`.
- **Ficha:** botón editar y menú "Más acciones" (estado/papelera); acciones rápidas y principales
  (nota/recordatorio/programar/registrar venta); "+" de nueva oportunidad; selector de prioridad y
  botón de etiquetas (pasan a **solo lectura**); tarjetas de oportunidad no abren la hoja de etapa.
- **Recordatorios:** menú de gestión oculto en Inicio y en la ficha (`AccionesRecordatorio` con doble
  guardia).
- **Lista vacía / sin resultados:** enlaces "crear cliente" ocultos.
- **Guards de ruta** en las 7 páginas de creación/edición (`/clientes/nuevo`, `.../editar`,
  `.../nota`, `.../oportunidad`, `.../recordatorio`, `/seguimientos/nuevo`, `/ventas/nueva`).
- Inicio **no dispara** `sincronizarInactividad` para el observador (el cron lo hace igual).

Contacto preservado: los botones tel:/mailto: de la tarjeta de perfil siguen (caso de uso del PRD:
asistente que responde llamadas).

--------------------------------------------------------------------

## Decisiones de alcance (para tu revisión)

- **`usuarios.actualizarPerfil` y `auth.cambiarPassword` siguen disponibles al observador:** son su
  PROPIA cuenta (nombre/email/contraseña), no datos del negocio. Necesita poder fijar su contraseña
  al recibir el enlace. No es "editar un registro" del CRM.
- **`sincronizarInactividad` no se bloqueó en servidor** (mantenimiento idempotente que el cron ya
  hace); en su lugar, la UI del observador no la dispara. Si prefieres bloquearla también en
  servidor, es un cambio de una línea.
- **La hoja de cambio de etapa** no se abre para el observador (la tarjeta no es clicable); su
  contenido (etapa, monto, cierre) ya se ve en la propia tarjeta.

--------------------------------------------------------------------

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build          OK
npx eslint .       OK      npx convex dev --once  OK
```

**Negativas de servidor (CLI, sesión REAL de un observador activado por invitación):**
- Lecturas OK: `clientes.listar` (16 filas), `clientes.detalle` (Ana García).
- **Escrituras → "No autorizado":** crear cliente, cambiarEstado, cambiarPrioridad, cambiarEtiquetas,
  actualizar, notas.crear, oportunidades.crear, cambiarEtapa, ventas.crear (con fecha),
  marcarSeguimientoRealizado, seguimientos.cancelar/eliminar/reprogramar. **13/13.**
- Admin-only con observador → rechazadas (mensaje admin o "No autorizado"): enviarAPapelera,
  vaciarPapelera, notas.eliminar, oportunidades.eliminar, usuarios.invitar, etiquetas.crear,
  exportaciones.solicitar.

**Driver UI (dev, 390×844, credenciales por env): 17/17 PASS** — `tmp/drivers-jua42/driver-20-observador.js`:
- A: la hoja de invitar ofrece los 3 roles (Administrador/Operativo/Observador).
- B: Inicio y lista sin FAB; ficha carga en lectura SIN editar, "Más acciones", registrar venta,
  programar seguimiento, "+" de oportunidad, selector de prioridad ni botón de etiquetas.
- C: `/clientes/nuevo`, `/clientes/[id]/nota` y `/ventas/nueva` por URL → redirigen a `/inicio`.

Capturas: `tmp/capturas-jua42/` (ficha del observador en lectura · selector de 3 roles).
Usuario QA en dev: `observador.qa@test.mx` (rol observador, activo).

Cobertura de criterios de aceptación: **navegar consulta sin modificar** ✔ · **API devuelve 403 al
crear/editar** ✔ (13/13 + admin-only) · **Marta invita con rol Observador** ✔.

--------------------------------------------------------------------

## Si el dictamen es GO

`npx convex deploy` (schema aditivo — el enum `rol` añade un literal — + funciones, ANTES del
frontend) → `git push` → Railway → verificación en vivo (invitar/activar un observador de prueba en
prod, negativas + navegación) → JUA-42 Done + comentario → evidencia a `auditorias/` → estado de
producción. Nota: los usuarios existentes conservan su rol; el literal nuevo no rompe datos.
