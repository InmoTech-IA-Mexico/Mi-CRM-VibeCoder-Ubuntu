# Acta — Follow-ups de cierre de auth · v2 (observaciones del dictamen v1 aplicadas)

Fecha: 2026-07-15
Commits candidatos: `fc02288` (GO del dictamen v1) + `338e28c` (aplica OBS-1/2/3)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Referencia: dictamen v1 = **GO CON OBSERVACIONES NO BLOQUEANTES** sobre `fc02288`.

--------------------------------------------------------------------

## Observaciones aplicadas

**OBS-1 — La bienvenida no sobrevivía una recarga → RESUELTA (`338e28c`)**
La bienvenida se persiste en `sessionStorage` con clave por token de invitación al activar. La lectura
usa `useSyncExternalStore` (snapshot de servidor = null → sin desajuste de hidratación, y sin `setState`
síncrono en efecto, que la regla `react-hooks/set-state-in-effect` del lint rechaza). **Empezar** limpia
la clave: revisitar el enlace después muestra el estado real ("Cuenta ya activada"). Al morir la pestaña,
muere la clave.

**OBS-2 — Accesibilidad de la bienvenida → RESUELTA (`338e28c`)**
- Nombre en `gold-text` (#A87E33) sobre crema: contraste ≈3.5:1, cumple WCAG AA para texto grande
  (28 px semibold). Antes `gold-500` ≈2.25:1.
- Halo con `motion-reduce:animate-none` (respeta `prefers-reduced-motion`).
- Foco programático al `<h1>` (`tabIndex={-1}` + focus al montar) para que lectores de pantalla
  anuncien el resultado del cambio dinámico de pantalla.

**OBS-3 — Evidencia automatizada no preservada → RESUELTA (sin código)**
Drivers archivados en `tmp/drivers-followups-auth/` (6 scripts + README con requisitos, uso, tokens y
resultados de cada corrida). Capturas en `tmp/capturas-followups-auth/`.

**OBS-4 — Riesgo futuro multinegocio → REGISTRADA, sin cambio (aprobado en v1)**
Queda anotada en la memoria del proyecto: antes de habilitar aprovisionamiento multinegocio, impedir
invitaciones pendientes duplicadas globalmente o revalidar el email en `reenviar`.

--------------------------------------------------------------------

## Re-verificación (0 errores)

```txt
npx eslint .           OK  (la 1.ª iteración de OBS-1 con useEffect fue rechazada por el lint
                            react-hooks/set-state-in-effect y se reimplementó con useSyncExternalStore)
npx tsc --noEmit       OK
npm run build          OK
```

**Driver 6 (nuevo, contra dev): 18 PASS / 0 FAIL en total**
- 1.ª corrida (12 PASS): operativo y admin — bienvenida visible tras activar · **sobrevive a la
  recarga** · Empezar → `/inicio` con sesión · revisitar el enlace tras Empezar muestra "Cuenta ya
  activada".
- Corrida final sobre la implementación definitiva con `useSyncExternalStore` (6 PASS, operativo,
  invitación fresca): mismos seis puntos.
- Captura post-recarga con el nombre ya en `gold-text`: `tmp/capturas-followups-auth/d6-bienvenida-op-reload.png`.

Los flujos de backend (recuperación endurecida, unicidad global) no cambiaron en `338e28c`
(solo se tocó `pantalla-activar.tsx`); su evidencia es la del acta v1 (drivers 1–3 + check de servidor).

--------------------------------------------------------------------

## Datos de prueba adicionales en DEV

Se suman a los del acta v1: `rocio.prueba@test.mx`, `aida.prueba@test.mx`, `nadia.prueba@test.mx`
(activadas con contraseña `Prueba1234!`). Negocio demo y usuarios seed intactos.

--------------------------------------------------------------------

## Listo para desplegar

El GO del dictamen v1 cubre `fc02288`; `338e28c` aplica sus propias observaciones (solo UI de
activación). Con tu **luz verde explícita** ejecuto:

1. `npx convex deploy` (funciones a prod `glad-bird-297`)
2. `git push` (Railway construye `338e28c`)
3. Verificación en vivo (las 4 comprobaciones mínimas del dictamen)
4. Comentario en Linear (JUA-7 y JUA-8/9 siguen abiertas hasta Resend) + archivar actas +
   actualizar `tmp/estado-produccion.md`
