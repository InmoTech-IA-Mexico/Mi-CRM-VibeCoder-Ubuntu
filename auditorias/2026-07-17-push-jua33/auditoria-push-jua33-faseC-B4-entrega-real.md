# Acta de evidencia — JUA-33 Fase C · B-4 entrega real automática + deep-link

Fecha: 2026-07-17
Base de código: `6a693cc` (B-1/B-2/B-3 cerrados). **B-4 es prueba manual: sin cambios de código ni commit.**
Referencia: dictamen B-1/B-2 v2 = **B-1/B-2/B-3 CERRADOS; NO-GO global solo hasta cerrar B-4**, con 4
condiciones explícitas.
Veredicto propuesto: **B-4 cumplido; se solicita la re-auditoría GLOBAL de JUA-33.**

--------------------------------------------------------------------

## Qué exigía el auditor (4 condiciones) y cómo se cumplió

| # | Condición del dictamen | Evidencia |
|---|---|---|
| 1 | Usar el **flujo automático** de cliente frío, no el botón de prueba | `pushEnvio.flushNotificaciones` sobre una fila encolada por `encolarClienteFrio` (payload `url:/clientes/[id]`, `tag:frio-[id]`) — NO `enviarPrueba` (que manda `/inicio`). |
| 2 | Recepción con **título y cuerpo del cliente esperado** | El usuario recibió "⚠️ Cliente frío" / "Sofía Beltrán lleva 15 días sin contacto". |
| 3 | Tocarla y confirmar que abre **`/clientes/[id]`**, no `/inicio` | El usuario confirmó: abrió la **ficha de Sofía Beltrán**, no Inicio. |
| 4 | **Limpiar/restaurar** el fixture, sin suscripciones/preferencias/alertas QA residuales | Sofía → `activo` con recordatorio futuro restaurado; 0 notificaciones; usuario apagó el aviso → **0 suscripciones**; prefs por defecto (Carlos `cartera`, Marta `ninguna`). |

## Resultado del emisor (flush limpio)

```json
{ "reclamadas": 1, "enviadas": 1, "conFallo": 0 }
fila terminal → { "estado": "enviada", "resultado": "entregada", "audiencia": "responsable" }
```

## Corrección del acta anterior (obs. del dictamen Fase C v1)

El dictamen señaló que la prueba del 2026-07-16 atribuía a la alerta automática un clic que en realidad se
hizo con **"Enviar notificación de prueba"** (que abre `/inicio` por diseño). Queda **corregido**: se añadió
una **errata** a `tmp/drivers-jua33/reporte-entrega-real-manual-dev.txt` y el deep-link de la alerta
**automática** a `/clientes/[id]` se validó ahora en B-4 (condición 3).

## Incidencia durante la prueba y su resolución (transparencia)

- El **primer** flush devolvió `{enviadas:0, conFallo:1}`. Causa: Carlos tenía **2 suscripciones**, una
  **nueva viva** y una **vieja muerta**. Diagnóstico local (`web-push` con las claves de `.env.local`): la
  nueva entregó **201**; la vieja falló con **`statusCode=undefined`** (error de red, no 404/410).
- Se verificó que las claves VAPID **pública y privada COINCIDEN** entre `.env.local` y el entorno de Convex
  **dev** (hash md5 igual) — la configuración era correcta; el ruido venía solo de la sub muerta.
- Se eliminó la sub muerta (`push.borrarSubCaducada`) → una sola sub viva → **flush limpio "entregada"**.

## Observación no bloqueante (para el registro)

Una suscripción que falla con **`statusCode=undefined`** (inalcanzable a nivel de red) se trata como fallo
**transitorio**: reintento con backoff hasta `MAX_INTENTOS` y luego `descartada` (`fallo_persistente`), sin
auto-borrar la fila de suscripción (solo 404/410 la borran). Es una decisión defendible (un `undefined`
puede ser un corte pasajero), pero un endpoint permanentemente muerto consume 3 intentos antes de
descartarse. Se documenta por si se desea, en una iteración futura, una política de poda tras N fallos de
red consecutivos.

## Evidencia archivable

- `tmp/drivers-jua33/reporte-B4-entrega-real-dev.txt` (procedimiento + resultados).
- Errata en `tmp/drivers-jua33/reporte-entrega-real-manual-dev.txt`.

## Estado consolidado — los cuatro bloqueantes

| Bloqueante | Estado |
|---|---|
| B-1 — revalidación de destino/audiencia y política vigente | Cerrado (`6a693cc`) |
| B-2 — preferencia opt-in respetada en encolado y reclamación | Cerrado (`6a693cc`) |
| B-3 — cola durable, lease y resultado real | Cerrado (`b08d399`+`5826b4b`) |
| **B-4 — entrega automática real + deep-link a la ficha** | **Cerrado (prueba real 2026-07-17)** |

## Solicitud

Se solicita la **re-auditoría GLOBAL de JUA-33 Fase C** para levantar el NO-GO. Recordatorio del propio
dictamen: aun con B-4 cerrada, el **despliegue** requiere cargar las claves VAPID por un operador autorizado
(pública en Railway; privada/subject en Convex prod) y verificación posterior en producción —
**pendiente del GO**, sin desplegar nada aún.

## Constancia

B-4 no modifica código de aplicación y quedó **sin cambios persistentes remanentes** (la prueba tocó
temporalmente datos de Convex dev —suscripción, alerta y fixture— que se restauraron: 0 subs, 0 notifs,
Sofía activa). Sin despliegue, sin `git push`, sin cambios en prod/remoto/Linear. (Redacción ajustada por
OBS-3 del dictamen global v2.)
