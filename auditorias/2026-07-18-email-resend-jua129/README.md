# Integración de email transaccional (Resend, JUA-129) — ciclo de auditoría y despliegue

**Fecha:** 2026-07-18.
**Resultado:** diseño NO-GO → impl NO-GO ×4 (B-1…B-4) → remediado → **GO v5** → **DESPLEGADO INERTE EN PROD +
VERIFICADO EN VIVO (dev, Resend real)**.
**Commit desplegado:** `3d398a3` (rango `2bb15ab..3d398a3`). **Base productiva previa:** `8c2dda0`.
**Prod:** Convex `glad-bird-297` (Railway sin cambio funcional de frontend).

## Qué se entregó

Envío automático por **Resend** de los enlaces que hoy se comparten con "copiar enlace": **invitación**
(JUA-8/9), **primer admin** de un negocio (JUA-41), **recuperación** (JUA-7) y **nueva contraseña al
reactivar** (JUA-125). "Copiar enlace" se conserva como *fallback*. Registro público (JUA-39) fuera.

Arquitectura: **outbox durable** (`emailsSalientes`), calcada de la cola de push (JUA-33).

- **`convex/emailCola.ts`** (parte durable): `encolar` (supersede eventos previos, agenda un flush **sin
  datos**), `reclamarLote` (recupera leases, **revalida y deriva** el token+destinatario en memoria, backoff),
  `registrarResultado` (clasifica ok/config/transitorio/terminal), `purgarAntiguos`. QA gateado.
- **`convex/emailEnvio.ts`** (`"use node"`): `flush` envía por la API REST de Resend con `Idempotency-Key`;
  **inerte** sin `RESEND_API_KEY`/`APP_BASE_URL`/`EMAIL_FROM`.
- **`convex/emailPlantillas.ts`** (puro, testeable): `escaparHtml`, `normalizarBaseUrl`, `normalizarRemitente`,
  `clasificarRespuestaEnvio`, plantillas en español.
- Cron `flush-emails` (5 min) + `purgar-emails-antiguos` (diario). Cableado en usuarios/recuperacion/negocios.

## Ciclo de auditoría (5 rondas)

- **Diseño NO-GO → GO:** exigió outbox durable (recuperación no tiene fallback), token fuera del scheduler,
  idempotencia.
- **Impl NO-GO ×4 → GO v5:**
  - **B-1** (v2): `tsc`/`build` fallaban por un driver `.ts` en el tsconfig de la app → se excluye `tmp/`.
  - **B-2** (v2): `APP_BASE_URL` sin validar → `normalizarBaseUrl` (HTTPS/solo origen) + enlace escapado.
  - **B-3** (v3): un 4xx de config descartaba correos críticos → clasificación `config` (401/403) no descarta,
    se reanuda; `EMAIL_FROM` obligatorio. OBS-1 índice de purga.
  - **B-4** (v4): `intentos` contaminaba el presupuesto de transitorios → contador `fallosTransitorios`
    independiente.
- **GO v5:** despliegue inerte controlado autorizado.

## Verificación

- **Unit (`node --experimental-strip-types`):** `test-plantillas.ts` — **30/30** (baseUrl, remitente,
  clasificación, escape/inyección, plantillas).
- **Protocolo durable (dev, QA_HELPERS=1, sin key → inerte):** `driver-45-email-cola.py` — **16/16**
  (B-1/B-2/B-3/B-4, config-no-descarta-reanuda, tope por `fallosTransitorios`, terminal-descarta,
  lease-recovery, revalidación, supersesión, inerte). Reporte en `drivers/`.
- **En vivo (dev, Resend real, a un correo autorizado):** invitación y recuperación **entregadas** (`ok_200`),
  verificadas en bandeja. Detalle en `despliegue-email-resend-jua129-prod-2026-07-18.md`.
- **Prod (glad-bird-297):** contrato verificado; `flush --prod` → `{reclamados:0}` (inerte); QA gateado.

## Estado y pendiente

**Desplegado inerte** (sin `RESEND_API_KEY` en prod) → no altera la experiencia actual. El **envío real en
prod** espera un **dominio verificado** en Resend (bloqueo externo, el mismo de JUA-7): `onboarding@resend.dev`
solo entrega al dueño de la cuenta. Al tener dominio: cargar `RESEND_API_KEY`/`EMAIL_FROM`/`APP_BASE_URL` en
Convex prod + QA revocable → declarar Done.

## Actualización — activación en producción (2026-07-19)

El despliegue del 2026-07-18 fue **inerte** (sin key). El **2026-07-19** se **activó el envío real en prod**:

- **Dominio `inmotechia.mx` verificado** en Resend (región us-east-1): DKIM (`resend._domainkey`) + SPF/MX
  (`send`) añadidos en Cloudflare; propagación confirmada por `dig` antes de verificar. Remitente productivo
  `InmoTech IA <no-reply@inmotechia.mx>`.
- **Convex prod:** `RESEND_API_KEY` + `EMAIL_FROM` + `APP_BASE_URL` (URL de Railway → los enlaces abren en el
  sitio real). `QA_HELPERS` sigue ausente. La key se cargó sin exponerla (recuperada de dev con
  `npx convex env get` y seteada con `--prod`, enmascarando el eco).
- **Verificación en vivo:** dev con el dominio → invitación `ok_200`; **prod QA revocable** → alta de prueba →
  cron `flush` → log de prod `[email] invitacion resultado=ok` → negocio QA cancelado (sin residuo). Los logs
  previos mostraban la cola **inerte** ("deshabilitado…"), confirmando el modo del despliegue anterior.
- **JUA-129 = Done.** En prod ya se envían por correo invitaciones (JUA-8/9), primer admin (JUA-41) y
  recuperación (JUA-7); "copiar enlace" queda como respaldo. Destraba la recuperación real de JUA-7 y la
  verificación de email de JUA-39.

## Nota

La `RESEND_API_KEY` (secreta) **no** se versiona. El correo del operador usado en la prueba viva y los tokens
de activación/recuperación **no** figuran en esta evidencia. Los reportes usan `carlos@demo.mx` y
`qa-jua129-*@test.mx`.

## Archivos

- `diseno-email-resend-jua129.md` — diseño + remediación de diseño (v2).
- `auditoria-email-resend-jua129-remediacion-v2..v5.md` — actas de remediación (B-1…B-4).
- `dictamen-email-resend-jua129-3d398a3-go-v5.md` — dictamen final (GO).
- `despliegue-email-resend-jua129-prod-2026-07-18.md` — despliegue inerte + prueba en vivo.
- `drivers/` — driver-45 + test de plantillas + reporte sanitizado.
