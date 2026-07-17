# Acta para dictamen — Alerta push de cliente frío (JUA-33) · Fase C (disparo automático) · v1

Fecha: 2026-07-16
Commit candidato: `337cc05` sobre `3e2af0f` (A+B remediado); base productiva `2136a30`
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Referencia: dictamen A+B v2 = **GO con obs (OBS-1/OBS-2), sin autorización de despliegue**
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Alcance

Fase C cierra el **flujo automático** de la alerta de cliente frío. Con ella, JUA-33 queda
funcionalmente completo: **A** (suscripción), **B** (emisor `web-push`), **C** (disparo automático) y
el **deep-link** (Fase D) ya validado en la prueba real (el clic abre la ficha). Falta solo el cierre
de despliegue (auditoría de C, env VAPID en prod y prueba real en prod).

Incluye además el **fold de las observaciones** del dictamen A+B v2 (OBS-1 y OBS-2).

--------------------------------------------------------------------

## Implementación

**Cola desacoplada (detección → entrega):**

- **Esquema:** tabla `notificacionesPush` (`negocioId`, `usuarioId` destinatario, `clienteId`, `tipo:
  "cliente_frio"`, `estado: pendiente|enviada|descartada`, `creadoEn`, `enviadaEn`). Índices
  `por_estado` y `por_cliente_tipo`.
- **Encolado (`convex/clientes.ts` › `encolarClienteFrio`):** en el **edge** de transición a Inactivo
  dentro de `transicionarClientes` (la usan el cron diario y la sync al abrir Inicio). Destinatario: el
  **responsable**; si el cliente está en el **pool** (sin responsable), los **admin activos** del
  negocio (cacheados por negocio). **Dedup:** no duplica una PENDIENTE del mismo cliente para el mismo
  destinatario (una nueva alerta solo se encola en un episodio de enfriamiento posterior).
- **Decisión de envío (`convex/notificaciones.ts` › `paraEnviar`, runtime normal):** por cada
  pendiente decide **descartar** (cliente borrado o ya no Inactivo → alerta obsoleta) o **enviar**
  (cliente sigue frío **y** es horario diurno **[9:00, 20:00)** en la zona horaria del negocio, vía
  `partesLocales`). Las de fuera de horario se dejan pendientes. Marcado con `marcarEnviada` /
  `marcarDescartada`.
- **Emisor (`convex/pushEnvio.ts` › `flushNotificaciones`, action Node):** orquesta — toma las de
  `paraEnviar`, envía al destinatario reutilizando `enviarAUsuario` (firma VAPID + `web-push`), marca.
- **Cron (`convex/crons.ts`):** `flush-notificaciones-push` **cada hora** (minuto 15 UTC). Corre cada
  hora para cubrir todas las zonas; el guard evita envíos nocturnos por tz.
- **Contenido:** "⚠️ Cliente frío" · "[Nombre] lleva 15 días sin contacto" · url `/clientes/[id]` ·
  `tag: frio-[clienteId]` (colapsa repetidos).

**Observaciones del dictamen A+B v2 foldeadas:**
- **OBS-1:** validación con `new URL` + `protocol === "https:"`, claves con alfabeto **base64url** y
  tamaño acotado; **tope de dispositivos** por usuario aplicado **tras** insertar o reasignar.
- **OBS-2:** el borrado de suscripciones caducadas es **condicional por id + versión** (`p256dh`), no
  por endpoint — evita borrar una fila reasignada o con claves renovadas por una carrera.

--------------------------------------------------------------------

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build   OK
npx eslint         OK      npx convex dev --once  OK (nueva tabla + índices + cron)
```

**Flujo automático en dev** (reporte `tmp/drivers-jua33/reporte-faseC-flujo-automatico-dev.txt`;
verificado por consulta directa MCP, sin secretos):
- **Encolado:** al transicionar un cliente a Inactivo (`sincronizarInactividad`, cambiados=1) se creó
  1 fila `notificacionesPush` {pendiente, cliente_frio, destinatario = responsable}.
- **Guard + flush:** con hora local del negocio **19:59** (dentro de [9,20)), `flushNotificaciones` →
  `{enviadas: 1}`; la fila quedó **enviada**.
- **Dedup:** re-ejecutar `sincronizarInactividad` → cambiados=0 (ya Inactivo; no re-encola).
- **Flush vacío:** segunda ejecución → `{enviadas: 0, descartadas: 0}`.
- **Restauración:** el dato demo tocado (un recordatorio) se devolvió a su estado.

**Método (limitación documentada):** no hay forma pública de **antedatar** un cliente; para forzar una
transición determinista se reprogramó el recordatorio de un cliente ya frío por fecha y luego se
restauró. Las ramas **guard nocturno** (hora fuera de 9–20 → pendiente) y **descartar obsoletas**
quedan cubiertas por revisión de código (la rama diurna se probó positiva).

**Entrega real:** ya validada manualmente en navegador (reporte `reporte-entrega-real-manual-dev.txt`):
la notificación llega y el clic abre la ficha. El destinatario del test de flujo tenía 0 dispositivos,
así que el flush no re-ejerció la entrega (ya cubierta).

--------------------------------------------------------------------

## Seguridad / notas

- Sin nueva superficie pública sensible: el encolado es interno (en la transición), el flush es un cron
  interno, y `notificacionesPush` no contiene datos que expongan otras carteras (destinatario derivado
  del responsable/admin del propio negocio).
- La clave privada VAPID sigue solo en entorno (nunca en repo/drivers/actas).
- Best-effort: si el destinatario no tiene dispositivos, la alerta se marca procesada; el panel de
  inactividad in-app sigue siendo la fuente de verdad.

## Pendiente antes de desplegar (condiciones del dictamen A+B)

1. **Auditoría de esta Fase C** (este documento).
2. **Cargar VAPID en prod:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en Railway + `VAPID_PUBLIC_KEY`/
   `VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` en Convex prod (`npx convex env set --prod`), y comprobar contra
   prod que ambos las consumen.
3. **Prueba de entrega real en prod** (recepción + deep-link) tras el deploy.

## Si el dictamen es GO

Desplegar JUA-33 completo: cargar env VAPID en prod → `npx convex deploy` (nueva tabla + funciones +
cron) → **verificar contrato contra prod** → `git push` → Railway → **prueba de entrega real en prod**
→ cerrar JUA-33 + archivar evidencia a `auditorias/2026-07-16-push-jua33/`.
Commits de JUA-33: `64fb26d`+`565c5d6`+`5956a9f`+`3e2af0f`+`337cc05`.
