# Acta de avance — JUA-33 Fase C · remediación B-1 + B-2 (y B-4 en curso)

Fecha: 2026-07-17
Commits candidatos: `70e222d` (B-1) y `4fff2b5` (B-2), sobre `b08d399`+`5826b4b` (B-3) y `337cc05` (Fase C v1).
**JUA-33 completo NO desplegado** (sigue solo en local + dev de Convex).
Referencia: dictamen Fase C v1 = **NO-GO** por B-1, B-2, B-3, B-4.
Veredicto propuesto: **B-1, B-2 y B-3 REMEDIADOS y verificados; B-4 EN EJECUCIÓN (prueba real en dispositivo).**
El NO-GO se solicitará levantar al cerrar B-4 con evidencia de entrega real.

> Continúa el acta de avance de B-3 (`auditoria-push-jua33-faseC-B3-avance.md`). Aquí se cubren **B-1 y B-2
> (cerrados)** y el **estado de B-4** (prueba manual de entrega real, en curso al emitir este documento).

Estado de los cuatro bloqueantes del NO-GO:

| Bloqueante | Estado | Commit |
|---|---|---|
| B-3 — cola durable (reclamación, lease, reintento, resultado real) | ✅ REMEDIADO | `b08d399` + `5826b4b` |
| B-1 — revalidación transaccional del destino al reclamar | ✅ REMEDIADO | `70e222d` |
| B-2 — preferencia de alertas por usuario (opt-in), ≠ suscripción | ✅ REMEDIADO | `4fff2b5` |
| B-4 — prueba real del flujo automático + deep-link a la ficha | 🔄 EN CURSO | — |

--------------------------------------------------------------------

## B-1 — Revalidación transaccional del destino al reclamar → REMEDIADO (`70e222d`)

**El defecto (dictamen v1):** el destinatario y la vigencia de la alerta se fijaban **al encolar**. Entre
encolar y enviar (hasta 1 h por el cron) el mundo cambia: puede aparecer un recordatorio próximo, el
responsable puede desactivarse, o el cliente puede reasignarse — y la alerta se enviaba igual, a quien ya
no correspondía.

**La remediación:** `notificaciones.revalidarDestino`, invocada dentro de `reclamarLote` **en el momento
del envío** (transaccional, misma mutación que mueve la fila a `enviando`):

- **Recordatorio próximo (≤3 días)** recalculado ahora → **descarta** (`resultado: recordatorio_proximo`);
  ya hay seguimiento previsto, la alerta sobra.
- **Cliente con responsable:** el destino correcto es el responsable **actual**. Si se reasignó mientras
  esperaba → **redirige** al nuevo responsable; si el responsable está inactivo → descarta
  (`responsable_inactivo`).
- **Cliente en el pool (sin responsable):** solo un **admin activo** es destino válido; si no →
  descarta (`destinatario_no_corresponde`).

**Evidencia dinámica** (`tmp/drivers-jua33/reporte-B1-revalidacion-dev.txt`, driver-34, 4/4):
- Recordatorio próximo → descartada/`recordatorio_proximo`.
- Reasignación entre encolar y reclamar → la alerta se **redirige** al responsable actual y se reclama.
- Responsable inactivo → descartada; pool sin admin válido → descartada.

## B-2 — Preferencia de alertas por usuario (opt-in), distinta del transporte → REMEDIADO (`4fff2b5`)

**El defecto (dictamen v1):** suscribir el dispositivo (Web Push) era, de facto, aceptar **todas** las
alertas. No existía una entidad de preferencia: Marta (admin) no podía optar por recibir solo las del pool
o ninguna, y un operativo no podía silenciarlas sin desuscribir el dispositivo.

**La remediación:** preferencia **persistente por usuario**, separada del transporte:

- **Esquema:** `usuarios.prefClienteFrio` opcional (`ninguna` | `cartera` | `pool` | `negocio`). Ausente =
  por defecto de rol: operativo `cartera`, admin `ninguna` (**opt-in explícito** para el admin). Sin
  migración (opcional).
- **`push.miPreferenciaFrio` / `push.guardarPreferenciaFrio`:** consulta y guarda la preferencia; **valida
  el valor contra el rol** (admin: ninguna/pool/negocio; operativo: ninguna/cartera; observador: solo
  ninguna).
- **`clientes.encolarClienteFrio`:** los destinatarios se derivan de la preferencia — el **responsable**
  recibe si la suya incluye su cartera (`cartera` o `negocio`); los **admin** reciben según `negocio`
  (todo el negocio) o `pool` (solo clientes sin asignar). El observador no recibe.
- **UI (`/perfil`):** selector "¿Qué alertas de cliente frío recibir?" (admin: Ninguna / Solo sin asignar /
  Todo el negocio; operativo: Mis clientes / Ninguna), aparte del interruptor del dispositivo.
- **Revocación:** `usuarios.desactivar` ya borra las suscripciones push del usuario dado de baja.

**Evidencia dinámica** (`tmp/drivers-jua33/reporte-B2-preferencias-dev.txt`, driver-35, 5/5):
- Defaults: operativo `cartera` recibe; admin `ninguna` no recibe.
- Operativo `ninguna` → no se encola para él.
- Admin `negocio` → recibe además del responsable.
- Admin `pool` + cliente en el pool → **solo** el admin; admin `pool` + cliente con responsable → el admin
  **no** recibe.

--------------------------------------------------------------------

## B-4 — Prueba real del flujo automático + deep-link a la ficha → EN CURSO

**El defecto (dictamen v1):** el acta de Fase C atribuía a la alerta **automática** una prueba de clic que
en realidad se hizo con el **botón "Enviar notificación de prueba"** (que abre `/inicio` a propósito). El
deep-link a la ficha del cliente nunca se ejerció de extremo a extremo.

**Verificación de código (previa a la prueba real):** el camino automático **sí** arma el deep-link:
- `pushEnvio.flushNotificaciones` construye el payload con `url: /clientes/${clienteId}` y
  `tag: frio-${clienteId}` (distinto del `/inicio` del botón de prueba).
- `public/sw.js`: el `push` guarda `data.url`; el `notificationclick` **navega/abre `data.url`** (enfoca la
  ventana existente si la hay, o abre una nueva).

**Prueba real en ejecución** (requiere dispositivo suscrito; no automatizable headless):
1. Suscripción real del dispositivo de **Carlos** (operativo, pref por defecto `cartera`) en `/perfil`.
2. Disparo del flujo **automático**: se recicla a **Sofía Beltrán** (cartera de Carlos) a estado frío →
   `encolarClienteFrio` encola la alerta → `flushNotificaciones` (dentro del horario diurno) la envía.
3. Verificación en dispositivo: llega la notificación **"⚠️ Cliente frío — Sofía Beltrán…"** de forma
   **automática** (no el botón de prueba) y, al tocarla, abre la **ficha de Sofía**
   (`/clientes/j570t8dpsvdjayqytts4psjbbd8a9q75`), **no** Inicio.

> RESULTADO DE LA PRUEBA REAL (a completar al ejecutarla): _pendiente de registrar._

--------------------------------------------------------------------

## Verificación estática (0 errores)

```txt
npx tsc --noEmit   OK        npm run build          OK
npx eslint         OK        npx convex dev --once  OK (nuevo campo prefClienteFrio + contratos push)
```

Notas de método: helpers QA solo en dev (`QA_HELPERS=1`, inertes en prod, admitidos por el auditor); datos
demo restaurados por cada driver; sin secretos en repositorio ni en las actas (la clave privada VAPID vive
solo en `.env.local`/entorno, nunca versionada). Ante la imposibilidad de antedatar clientes, se recicla el
cliente demo con `cambiarEstado`→activo (conserva la `ultimaInteraccion` vieja) para forzar la transición.

## Cierre previsto

Al capturar el **resultado de la prueba real de B-4** se solicitará la **re-auditoría de la Fase C** para
levantar el NO-GO. El despliegue (VAPID en Railway + entorno de Convex prod, `npx convex deploy` con
verificación del contrato en prod, `git push`, prueba real en prod y archivo en
`auditorias/2026-07-17-push-jua33/`) queda supeditado al GO.
