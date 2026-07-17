# Acta de avance — JUA-33 Fase C · remediación B-3 (cola durable) · parcial

Fecha: 2026-07-17
Commit candidato: `b08d399` sobre `337cc05` (Fase C v1); base productiva `2136a30`
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Referencia: dictamen Fase C v1 = **NO-GO** por B-1, B-2, B-3, B-4
Veredicto: **PENDIENTE — AVANCE PARCIAL (solo B-3); el NO-GO NO se levanta aún**

> Nota de alcance: este documento cubre **únicamente la remediación de B-3**. Los bloqueantes **B-1,
> B-2 y B-4 siguen abiertos** (ver §"Pendiente"). No se solicita levantar el NO-GO todavía; es un
> checkpoint para revisión temprana de la nueva capa de cola.

--------------------------------------------------------------------

## B-3 — Cola sin reclamación / estado de envío / reintento → REMEDIADO

**El defecto (dictamen v1):** el flush marcaba cada fila como `enviada` **sin examinar el resultado
real** del emisor (un fallo, "sin dispositivos" o entrega parcial quedaban como enviados) y no había
recuperación si la action caía entre enviar y marcar; los únicos estados eran pendiente/enviada/
descartada (sin `enviando`, lease, contador ni reintento).

**La remediación (`b08d399`):**

- **Esquema `notificacionesPush`:** nuevo estado **`enviando`**; campos `intentos`, `proximoIntento`
  (backoff), `leaseHasta` (vigencia de la reclamación), `resultado` (razón terminal). Opcionales →
  compatibles con filas previas, sin migración.
- **`notificaciones.reclamarLote` (internalMutation):**
  1. **Recuperación:** las `enviando` con `leaseHasta < ahora` (action caída) vuelven a `pendiente`.
  2. **Reclamación:** de las pendientes elegibles (`proximoIntento <= ahora`), por lotes (`LOTE_MAX=50`),
     descarta las obsoletas (cliente borrado o ya no Inactivo → `resultado: cliente_obsoleto`), respeta
     el guard de horario diurno [9:00,20:00) por zona del negocio, y mueve el resto a `enviando` con
     lease (`LEASE_MS=5min`) e `intentos++`.
- **`notificaciones.registrarResultado` (internalMutation):** decide según el **resultado REAL** del
  emisor: `fallidas===0` → `enviada` (`resultado: entregada | sin_dispositivos`); con fallos y
  `intentos < MAX_INTENTOS(3)` → reintento (`pendiente`, `proximoIntento = ahora + intentos*30min`);
  agotados los intentos → `descartada` (`resultado: fallo_persistente`). **Idempotente:** solo actúa si
  la fila sigue en `enviando` y en el MISMO intento reclamado (evita resolver con un lease perdido).
- **`pushEnvio.flushNotificaciones` (action Node):** reclama un lote → envía (`enviarAUsuario`) →
  registra el resultado real de cada uno.
- **`clientes.encolarClienteFrio`:** inicializa `intentos=0`, `proximoIntento=ahora`.

Semántica declarada: el **evento CRM es único** (una alerta por episodio, dedup por pendiente); la
**entrega externa es best-effort** y puede duplicarse excepcionalmente tras una recuperación de lease.

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build   OK
npx eslint         OK      npx convex dev --once  OK (nuevo estado + campos)
```

**Dinámica en dev** (reporte `tmp/drivers-jua33/reporte-B3-cola-durable-dev.txt`; estados por consulta
directa MCP, sin secretos; cliente demo reciclado con `cambiapEstado`→activo que conserva su
`ultimaInteraccion` vieja, ante la imposibilidad de antedatar):
- **Reclamación:** encolar + flush → `reclamadas=1` (fila a `enviando` con lease, `intentos=1`).
- **FALLO → REINTENTO (fix central):** con una suscripción fake del destinatario, flush →
  `{reclamadas:1, enviadas:0, conFallo:1}`; la fila quedó **`pendiente`**, `intentos=1`, `proximoIntento`
  en el futuro, lease limpio → **un fallo ya no se marca "enviada"**.
- **Éxito / sin dispositivos → `enviada`:** cubierto en la verificación de Fase C.

**Cubierto por código** (ramas dependientes de reloj/estado, no ejercidas dinámicamente por no poder
controlar el tiempo ni antedatar; se ejercerán con B-1 y en la prueba real de prod): recuperación de
lease vencido, progresión de reintentos hasta MAX→descartada, idempotencia por intento, descarte de
obsoletas.

--------------------------------------------------------------------

## Pendiente (bloqueantes del NO-GO aún abiertos)

- **B-1** — revalidación transaccional al reclamar: **recordatorio próximo** (si aparece en 3 días
  entre encolar y enviar → no enviar) y **destinatario vigente** (activo + responsable actual; si
  reasignaron, redirigir o descartar). El punto de enganche ya está en `reclamarLote`.
- **B-2** — **entidad de preferencias** por usuario/negocio para `cliente_frio` (la suscripción ≠
  opt-in). Marta opt-in (ninguna/pool/todo-negocio); operativo = su cartera. Con UI.
- **B-4** — **prueba real del flujo automático** a un dispositivo suscrito, verificando el clic al
  deep-link `/clientes/[id]` (+ corregir el acta de Fase C que atribuía esa prueba a la de Inicio).
- OBS: `eventoId` por episodio; drivers para guard nocturno / recordatorio tardío / reasignación /
  revocación; limpiar residuo QA en dev.

Orden previsto: **B-1 → B-4 → B-2**, y al completar los cuatro se solicita la re-auditoría de la Fase C.
