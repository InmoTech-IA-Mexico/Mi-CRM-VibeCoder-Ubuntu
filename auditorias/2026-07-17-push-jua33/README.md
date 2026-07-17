# Alerta push de cliente frío (JUA-33) — ciclo de auditoría y despliegue

**Fecha:** 2026-07-16 → 2026-07-17
**Resultado:** **GO CON OBSERVACIONES** (Fase C global v2) → **DESPLEGADO Y VERIFICADO EN VIVO (prod)** →
**CIERRE PRODUCTIVO RATIFICADO** (postdespliegue v3).
**Commit desplegado:** `6a693cc` (main). **Base productiva previa:** `2136a30`.
**Prod:** Convex `glad-bird-297` + Railway `Mi-CRM-VibeCoder-Ubuntu` (deployment `ed8f1c22`).

## Qué se entregó

Notificación **Web Push** cuando un cliente lleva 15 días sin contacto, aunque la app esté cerrada
(PWA; iOS 16.4+ solo instalado). Suscripción por dispositivo, **preferencia opt-in por usuario**
(distinta del transporte), **cola durable** con reintentos, **disparo automático** por cron horario en
horario diurno del negocio, y **deep-link** de la notificación a la ficha del cliente.

- **Fase A:** suscripción Web Push (`push.ts`, tabla `pushSubscriptions`).
- **Fase B:** emisor VAPID en runtime Node (`pushEnvio.ts`, `web-push`) + prueba real.
- **Fase C:** disparo automático (transición a frío encola en `notificacionesPush`; cron `flush`).

## Bloqueantes del NO-GO de Fase C y su cierre

- **B-1** — revalidación transaccional del destino al reclamar (recordatorio próximo + destinatario
  vigente). Cerrado en `6a693cc`.
- **B-2** — preferencia persistente por usuario (`prefClienteFrio`), respetada en encolado **y**
  reclamación. Cerrado en `6a693cc`.
- **B-3** — cola durable: `enviando`/lease/recuperación, reintento con backoff, resultado real
  (`entregada`/`suscripcion_caducada`/`sin_dispositivos`), idempotencia por intento. `b08d399`+`5826b4b`.
- **B-4** — entrega automática real + deep-link a la ficha. Verificado en dev y **reconfirmado en prod**.

**Defecto de audiencia (dictamen B-1/B-2 v1):** al reclamar, una fila de admin se reasignaba al
responsable (duplicado + admin perdía su alerta) y no se revalidaba la preferencia vigente. Corregido en
`6a693cc`: audiencia **materializada** por fila (`responsable`/`admin_negocio`/`admin_pool`) + fuente única
`prefFrioEfectiva` usada por encolar y revalidar.

## Manejo de observaciones (dictámenes global v2 y postdespliegue v3)

- **OBS-2 (v2)** — `QA_HELPERS` ausente en prod verificado antes del deploy; funciones `qa*` inertes.
- **OBS-3 (v2/v3)** — redacción ajustada a "sin residuos funcionales salvo la fila terminal documentada"
  en las actas de despliegue y B-4; evidencia sanitizada archivada en esta carpeta.
- **OBS-1 (v3) — RESUELTA:** el cron horario **se observó en vivo** ejecutando `flushNotificaciones` con
  `caller: "Cron"` a las **21:15:01 y 22:15:01 UTC** del 2026-07-17 (schedule `minuteUTC: 15`); la
  verificación de entrega usó un flush **invocado manualmente** (aclarado en el acta de despliegue).
- **OBS-2 (v3)** — la fila terminal QA se registra en el inventario del acta de despliegue.
- **OBS-4 (v2/v3) — diferidas:** poda de suscripción muerta (`statusCode=undefined`) tras N fallos de red;
  índice de la cola por `estado`+`proximoIntento`. No condicionan el cierre.

## Verificación

- **Dev:** B-3 dinámico 7/7 (`reporte-B3-dinamico-dev.txt`); B-1 4/4 (`reporte-B1-revalidacion-dev.txt`);
  B-2 5/5 (`reporte-B2-preferencias-dev.txt`); audiencia B-1/B-2 **7/7** (`reporte-B1B2-audiencia-dev.txt`).
- **Dev — entrega real:** flujo automático + deep-link a la ficha (`reporte-B4-entrega-real-dev.txt`).
  Errata sobre la prueba del 2026-07-16 (el botón de prueba abre `/inicio` por diseño) en
  `reporte-entrega-real-manual-dev.txt`.
- **Producción (glad-bird-297) — en vivo:** `npx convex deploy` con push completo + contrato verificado
  (`function-spec --prod`); prueba automática real con **cuenta QA revocable** (`qa-push-prod@test.mx`):
  flush `{reclamadas:1, enviadas:1, conFallo:0}` → notificación → **abrió la ficha del cliente**. Cliente
  restaurado y QA revocado (0 subs). Detalle en `despliegue-push-jua33-prod-2026-07-17.md`.

## Incidencias (lecciones)

- **Railway:** la variable pública `NEXT_PUBLIC_VAPID_PUBLIC_KEY` no había quedado guardada en el servicio,
  así que el build del `git push` salió sin ella y el interruptor no aparecía (`configurado=false`). Se
  creó por CLI de Railway → build nuevo la inyecta. **Lección:** los `NEXT_PUBLIC_*` se inyectan en el
  build; verificar la variable en el servicio y forzar rebuild.
- **Sub muerta:** una suscripción vieja devolvía `statusCode=undefined` (error de red, no 404/410) → se
  trata como fallo transitorio y no se auto-borra. Se depuró con `borrarSubCaducada`. (OBS-1 diferida.)

## Archivos

- `auditoria-push-jua33-*.md` — actas entregadas a auditoría (Fases A/B, Fase C, remediaciones, B-4).
- `despliegue-push-jua33-prod-2026-07-17.md` — acta de despliegue + verificación en vivo.
- `dictamen-*.md` — dictámenes del auditor (diseño, Fases A/B, Fase C, B-3, B-1/B-2, global v2 GO).
- `diseno-jua33-push-cliente-frio.md` — diseño de referencia.
- `drivers/` — drivers de verificación (`driver-31/33/34/35/36`) + reportes sanitizados (dev). Sin secretos.
