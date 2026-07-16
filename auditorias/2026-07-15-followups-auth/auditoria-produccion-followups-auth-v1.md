# Acta para dictamen — Follow-ups de cierre de auth (JUA-7 · JUA-8/9 · JUA-29) · v1

Fecha: 2026-07-15
Commit candidato: `fc02288` (sobre prod actual `2cc9d44`)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Alcance

Los tres follow-ups de bajo esfuerzo que quedaron anotados para el cierre productivo de la fase de auth
(no requieren Resend; el email real sigue siendo el único bloqueante para cerrar JUA-7 y JUA-8/9):

1. **Recuperación solo para usuarios activos** (obs. no bloqueante del dictamen v2 de JUA-7).
2. **Unicidad global de email en `usuarios.invitar`** (deuda anotada al desplegar JUA-8/9).
3. **Pantalla de bienvenida de activación** (omitida por alcance en JUA-8/9; spec en
   `Activacion Cuenta.dc.html`).

--------------------------------------------------------------------

## Cambios (6 archivos, +129 −19)

**`convex/recuperacion.ts`** — `porToken` y `restablecer` exigen ahora `usuario.estado === "activo"`.
Un enlace de recuperación emitido antes de revocar el acceso deja de valer mientras el usuario esté
desactivado (y vuelve a valer si se le reactiva dentro de las 24 h del enlace, coherente con que la
invalidación es por estado, no por borrado).

**`convex/usuarios.ts` (`invitar`)** — la validación de email pasa del recorrido por negocio al índice
**global** `por_email`, el mismo que ya usan `invitaciones.activar` y `usuarios.actualizarPerfil`. Evita
crear invitaciones condenadas a fallar en la activación si el email existe en otro negocio. Mensaje
alineado: "Ya existe una cuenta con ese email".

Además, los tres rechazos de validación de `invitar` (email no válido / cuenta existente / invitación
pendiente) pasan de `Error` a **`ConvexError`** (lección JUA-120): sin esto, el admin vería el fallback
"No se pudo enviar la invitación." y el propósito UX del follow-up (saber *por qué* falla) se perdía. El
driver lo confirmó: con `Error`, el mensaje no llegaba ni en dev.

**`src/app/(app)/usuarios/_components/pantalla-usuarios.tsx`** — el catch de la hoja "Invitar al equipo"
lee `error.data` (mismo patrón que perfil, replicado en local para no tocar código ya auditado de perfil).

**`src/app/(auth)/activar/_components/pantalla-activar.tsx`** — paso de **bienvenida** tras activar:
- Operativo: check verde con halo animado, "¡Te damos la bienvenida, {nombre}!", botón **Empezar**.
- Admin: sparkles dorado, "¡Todo listo, {nombre}!", "Tu negocio {nombre del negocio} está configurado…".
- La sesión se guarda al activar (igual que antes); solo se difiere la navegación a `/inicio` hasta
  pulsar Empezar. El estado de bienvenida se comprueba ANTES que el estado de la invitación porque la
  query reactiva pasa a "aceptada" al activar y taparía la pantalla.

**`convex/invitaciones.ts` (`activar`)** — devuelve también `nombre` (con el fallback al prefijo del
email ya aplicado) para el saludo de la bienvenida.

**`src/app/globals.css`** — animación `glowpulse` del diseño como token de Tailwind v4
(`--animate-glowpulse` + `@keyframes` en `@theme`).

--------------------------------------------------------------------

## Decisiones de alcance (para tu revisión)

- **Copy operativo:** el diseño dice "¡Bienvenido, Carlos!"; usé el neutro
  **"¡Te damos la bienvenida, {nombre}!"** porque el saludo lleva el nombre real de una persona de
  género desconocido. Si prefieres fidelidad literal al diseño, es un cambio de una línea.
- **Sin indicador "Paso 3 de 3":** el diseño plantea la activación admin en 3 pantallas con barras de
  progreso; nuestra implementación (ya en prod) resuelve contraseña + datos del negocio en una sola
  pantalla sin barras, así que añadirlas solo en la bienvenida sería inconsistente.
- **Unicidad cross-negocio:** en dev solo existe el negocio demo (no hay flujo de producto que cree un
  segundo negocio), así que el driver ejercita el duplicado con un usuario existente
  (`carlos@demo.mx`). El camino de código es idéntico: el índice `por_email` no filtra por negocio
  (verificable en el diff).
- **`reenviar` no cambia:** reenvía invitaciones ya creadas; la protección nueva actúa al crearlas.

--------------------------------------------------------------------

## Verificación ejecutada (0 errores)

```txt
npx eslint .           OK
npx tsc --noEmit       OK
npm run build          OK
npx convex dev --once  OK (funciones en dev merry-squirrel-978)
```

**Drivers Playwright (viewport 390×844, contra dev): 21 PASS / 0 FAIL**

- **Driver 1 — invitaciones (5 PASS):** login admin · invitación operativo · invitación admin ·
  invitar `carlos@demo.mx` muestra "Ya existe una cuenta con ese email" · reinvitar email con
  invitación vigente muestra "Ya hay una invitación pendiente para ese email".
- **Driver 2 — activación + bienvenida (9 PASS):** operativo activa → bienvenida (título, nombre,
  texto) → Empezar → `/inicio` con sesión · admin activa (zona por defecto CDMX = la del negocio demo,
  sin alterarlo) → bienvenida con negocio → Empezar → `/inicio`.
- **Driver 3 — recuperación endurecida (7 PASS):** enlace válido con usuaria activa · Marta la revoca →
  el mismo enlace pasa a "Enlace no válido" · la reactiva → vuelve a valer → restablecer → redirige a
  `/login?reset=1` → login con la contraseña nueva entra a `/inicio`.
- **Check de servidor:** con la usuaria revocada, `recuperacion:restablecer` invocada directa rechaza
  con "Enlace no válido" (la protección no depende de la UI).

**Capturas:** `tmp/capturas-followups-auth/` — bienvenida operativo, bienvenida admin, error de email
duplicado, enlace de recuperación inválido con usuaria revocada.

--------------------------------------------------------------------

## Datos de prueba que quedan en DEV (no en prod)

- `veronica.prueba@test.mx` (operativa, activa, contraseña `NuevaClave123`).
- `alberto.prueba@test.mx` (admin, activo, contraseña `Prueba1234!`).
- Invitación pendiente previa `qa-jua124@demo.mx` (de una sesión anterior).
- Marta/Carlos y el negocio demo quedaron intactos (zona `America/Mexico_City`, nombre sin cambios).

--------------------------------------------------------------------

## Si el dictamen es GO

Con tu OK explícito: `npx convex deploy` → `git push` → Railway → verificación en vivo → comentario en
Linear (JUA-7 sigue abierta a propósito hasta Resend) → archivar acta → actualizar
`tmp/estado-produccion.md`.
