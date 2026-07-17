# Acta para dictamen — Alerta push de cliente frío (JUA-33) · Fases A+B · v2 (remediación NO-GO)

Fecha: 2026-07-16
Commit candidato: `3e2af0f` (remediación) sobre `5956a9f` (v1); base productiva `2136a30`
Estado: remediado y verificado en local + dev de Convex. **NO desplegado.**
Referencia: dictamen v1 = **NO-GO** (B-1, B-2, B-3)
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Remediación de los bloqueantes

| # | Bloqueante v1 | Remediación (`3e2af0f`) |
|---|---|---|
| **B-1** | Al cambiar de cuenta en el mismo navegador, la suscripción seguía siendo del usuario anterior | Al montar `/perfil`, si hay una suscripción local, se **re-asocia al usuario actual** vía `guardarSubscription` (upsert por endpoint). La fila remota siempre pertenece a quien está en sesión. |
| **B-2** | Revocar un usuario no borraba sus suscripciones | `usuarios.desactivar` **borra todas las `pushSubscriptions`** del usuario en la misma mutación. |
| **B-3** | La prueba mostraba "no hay dispositivos" cuando el envío fallaba | El mensaje distingue **total=0** ("sin dispositivos"), **éxito total**, **entrega parcial** y **fallo total**. |

## Observaciones atendidas

- **OBS-1** — `borrarPorEndpoint` es **condicional por dueño** (recibe `usuarioId`; solo borra si la
  fila sigue siendo de ese usuario), evitando la carrera de reasignación al limpiar caducadas.
- **OBS-2** — `guardarSubscription` **valida** (endpoint HTTPS acotado, claves no vacías y cortas) y
  aplica un **tope de dispositivos por usuario** (evicta el más antiguo).
- **OBS-3** — la UI distingue "**navegador no compatible**" de "**config de despliegue pendiente**"
  (falta la clave pública VAPID, p. ej. env no cargado en Railway).
- **OBS-4** — **iconos PWA** 192/512/maskable + manifest e icono de notificación (antes solo favicon).

Añadida query `push.misDispositivos` (nº de dispositivos del propio usuario; también útil en la UI).

--------------------------------------------------------------------

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build   OK
npx eslint         OK      npx convex dev --once  OK
```

**Driver de servidor — 11/11 PASS** (dos operativos + un operativo QA revocable; reporte sanitizado) —
`tmp/drivers-jua33/driver-31-push-remediacion.py` (reporte `reporte-push-remediacion-dev.txt`):
- OBS-2: endpoint no-HTTPS y clave excesiva → rechazados.
- **B-1**: Carlos suscribe un endpoint → re-suscrito desde otra cuenta pasa al nuevo usuario; el dueño
  anterior no puede borrarlo, el nuevo sí (5 aserciones).
- **B-3**: con una suscripción que falla, `enviarPrueba` → `total>0, enviadas=0` (la UI mostrará fallo,
  no "sin dispositivos").
- Auth: `enviarPrueba` con token inválido → "No autorizado".
- **B-2**: el operativo QA tiene 1 dispositivo → tras `desactivar`, **0 suscripciones** (verificado por
  consulta directa a la tabla vía MCP `runOneoffQuery`: `subsDelQaDesactivado: 0`, tabla limpia).

## Pendiente antes de desplegar (condición #4 del dictamen)

- **Prueba de entrega real en un dispositivo** (y con ella, la aserción de UI de B-3 sobre el mensaje):
  requiere un navegador real con la clave pública VAPID cargada (reiniciar `npm run dev`, o tras
  desplegar con el env de prod). No es reproducible headless de forma fiable.
- **Fase C** (disparo automático + cron con guard de horario) permanece **separada**, conforme a la
  condición #5.

--------------------------------------------------------------------

## Cambios (commit `3e2af0f`)

`convex/push.ts` (validación, tope, `misDispositivos`, `borrarPorEndpoint` condicional) ·
`convex/pushEnvio.ts` (pasa `usuarioId`) · `convex/usuarios.ts` (limpieza en `desactivar`) ·
`src/components/push/tarjeta-notificaciones.tsx` (B-1, B-3, OBS-3) · `src/app/manifest.ts` +
`public/sw.js` + `public/icon-*.png` (OBS-4).

## Si el dictamen es GO (del checkpoint A+B)

No se despliega A+B en solitario (sin valor visible aún). Se continúa con **Fase C**; el despliegue se
hará cuando exista el flujo end-to-end y **tras la prueba de entrega real**, cargando las env VAPID en
Railway (pública) y Convex prod (`npx convex env set --prod`).
