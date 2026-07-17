# Acta de despliegue + verificación en producción — JUA-33 (alerta push de cliente frío)

Fecha: 2026-07-17
Commit desplegado: `6a693cc` (main). Base previa en prod: `2136a30`.
Convex prod: `glad-bird-297`. Frontend: Railway `Mi-CRM-VibeCoder-Ubuntu` (deployment `ed8f1c22`).
Dictamen habilitante: Fase C global v2 = **GO con observaciones no bloqueantes — despliegue controlado**.

--------------------------------------------------------------------

## Orden ejecutado (salvaguardas del dictamen)

1. **Claves VAPID (salvaguarda 1):**
   - Convex prod: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (cargadas por el operador; la
     privada nunca al repo). Verificado por nombre (sin volcar valores).
   - Railway: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (pública). **Incidencia:** en el primer intento la variable
     **no había quedado guardada** en el servicio → el build del `git push` salió sin ella y el interruptor
     mostraba "no disponible en este entorno". **Resolución:** se creó la variable por CLI de Railway, lo que
     disparó un build nuevo (`ed8f1c22`) que **sí** la inyecta; el interruptor aparece.
2. **`QA_HELPERS` ausente en Convex prod (salvaguarda 2 / OBS-2):** verificado (`env list --names-only`);
   las funciones `qa*` quedan desplegadas pero **inertes** (lanzan "QA helpers deshabilitados").
3. **Convex primero (salvaguarda 3):** `npx convex deploy` con pseudo-TTY (push completo, no solo
   "Deployed"): se subieron funciones, validó el esquema y **crearon los índices** de `notificacionesPush`
   (`por_estado`, `por_cliente_tipo`) y `pushSubscriptions` (`por_endpoint`, `por_usuario`).
   **Contrato verificado en prod** (`function-spec --prod`): existen `push.guardarSubscription/
   miPreferenciaFrio/guardarPreferenciaFrio`, `pushEnvio.flushNotificaciones/enviarPrueba`,
   `notificaciones.reclamarLote/registrarResultado`.
4. **Frontend después:** `git push` (`2136a30..6a693cc`) → build de Railway. Assets nuevos de JUA-33 sirven
   200 en prod (`/sw.js`, `/icon-192.png`, `/icon-512.png`, `/manifest.webmanifest`).

## Prueba real automática en prod (salvaguarda 4)

Con **cuenta QA revocable** (`qa-push-prod@test.mx`, operativo), no las cuentas demo principales:

1. Invitada por la admin, activada por el operador, suscrito un dispositivo real (Chrome). El **interruptor
   apareció** → confirma la variable pública de Railway en el build.
2. Flujo **automático** (no el botón de prueba): se reasignó **transitoriamente** un cliente frío
   (`Beltrán & Co`, 33 días, inactivo) al usuario QA y se recicló → `flushNotificaciones` en prod:
   `{ reclamadas: 1, enviadas: 1, conFallo: 0 }`.
3. En el dispositivo: llegó **"⚠️ Cliente frío"** con el nombre del cliente; al **tocarla abrió la ficha de
   Beltrán & Co**, no Inicio (verificado por el operador).

## Limpieza / restauración (salvaguarda 5)

- Cliente `Beltrán & Co`: **responsable original restaurado** y estado **inactivo** (como estaba). No se
  tocaron recordatorios (no tenía uno próximo).
- Usuario QA **revocado** (`usuarios.desactivar`): estado `inactivo`, **0 suscripciones** (se borraron).
- **Residuo documentado (inevitable en prod):** queda **1 fila de notificación terminal** (`enviada`) del
  usuario QA. En prod **no hay purga** (garantía de la salvaguarda 2: sin `QA_HELPERS`). Es un registro
  histórico inocuo del propio test.

## Estado

JUA-33 **desplegado y verificado en producción**: suscripción, preferencia, cola durable, disparo
automático por cron horario y **entrega real con deep-link a la ficha**. Los cuatro bloqueantes del NO-GO
quedaron cerrados (B-1/B-2/B-3 en `6a693cc`; B-4 real en dev y ahora **reconfirmado en prod**).

Observaciones no bloqueantes pendientes de iteración futura (no condicionan el cierre): **OBS-1** (poda de
suscripción muerta tras N fallos de red) y el **índice `notificacionesPush` por `estado`+`proximoIntento`**
(OBS-4, escala).

## Constancia

Despliegue realizado con GO del dictamen global v2. Secretos cargados por el operador, ninguno en repo/
drivers/actas. Datos de prod restaurados salvo el residuo terminal documentado. Evidencia a archivar
(sanitizada) en `auditorias/2026-07-17-push-jua33/`.
