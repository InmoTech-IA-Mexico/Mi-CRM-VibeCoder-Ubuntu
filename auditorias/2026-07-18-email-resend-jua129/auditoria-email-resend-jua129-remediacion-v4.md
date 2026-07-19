# Acta de remediación — Integración de email (Resend, JUA-129) · v4

Fecha: 2026-07-18
Responde a: dictamen de **implementación v3 = NO-GO** (B-3: un 4xx de config descartaba correos críticos).
Commit candidato: **`2bb15ab..b2f66ed`** (`main`, árbol limpio; sin desplegar).
Verificación: tsc 0 · eslint 0 · next build 0 · unit **30/30** · driver-45 **15/15**.

---

## Cierre del bloqueante B-3

**Problema:** con `RESEND_API_KEY` presente, un 4xx de **configuración/autorización del sistema**
(401 key revocada, 403 remitente/dominio no autorizado) se clasificaba como no reintentable y
`registrarResultado` lo marcaba `descartado`. Para una **recuperación** —que no tiene "copiar enlace"—
eso perdía el correo de forma permanente aunque después se corrigiera el entorno.

**Remediación (`b2f66ed`):**

1. **Clasificación por clase** (`clasificarRespuestaEnvio`, función **pura** en `emailPlantillas.ts`):
   - `ok` (2xx) → `enviado`.
   - **`config` (401/403)** → **NO se descarta**: el evento vuelve a `pendiente` con
     `resultado="bloqueado_config"` y una espera de 15 min. Al corregir el entorno, el **mismo evento**
     se reanuda y se envía **sin emitir un token nuevo**. Si nunca se arregla, el evento se descarta
     solo cuando su recurso caduca (revalidación al reclamar: recuperación 24 h / invitación 7 días).
   - `transitorio` (429/5xx/red) → backoff hasta `MAX_INTENTOS`, luego `descartado`.
   - `terminal` (otros 4xx, error real de la petición/destinatario) → `descartado`.
2. **`EMAIL_FROM` obligatorio con key** (`normalizarRemitente`, **pura**): sin remitente sintácticamente
   válido, `flush` queda **inerte antes de reclamar** (no se asume `onboarding@resend.dev` en silencio;
   tampoco se envía con un remitente malformado que Resend rechazaría con 4xx). En dev se debe cargar
   `EMAIL_FROM` explícitamente (p. ej. `InmoTech IA <onboarding@resend.dev>`).

**Pruebas deterministas** (transporte simulado vía `registrarResultado` + clasificación pura):
- Unit `clasificarRespuestaEnvio`: 200/202→ok, 401/403→config, 400/422→terminal, 429/500/503→transitorio.
- Unit `normalizarRemitente`: `Nombre <correo>` y correo suelto válidos; sin correo / vacío → `null`.
- driver-45 **T6a** (config 403 → `pendiente` `bloqueado_config`, **no** descartado), **T6b** (entorno
  corregido → **el mismo evento** se reanuda → `enviado`, sin token nuevo), **T7** (terminal 422 →
  `descartado`). El error terminal genuino del destinatario sigue descartándose.

## Observaciones del dictamen v3

- **OBS-1 (índice de retención):** aplicada. Nuevo índice `por_estado_creado` `[estado, creadoEn]`;
  `purgarAntiguos` reclama por rango de fecha (`.lt("creadoEn", corte)`) → los terminales más antiguos
  primero, sin depender de correlaciones ni filtrar en memoria.
- **OBS-2 (identidad del candidato):** el artefacto a auditar/desplegar es el rango
  **`2bb15ab..b2f66ed`** (impl + v2 + doc + B-3), no un commit aislado. Árbol limpio; `tmp/` es evidencia
  gitignored, fuera del artefacto.
- **OBS-3 (evidencia + prueba externa):** la evidencia sigue en `tmp/`; tras un GO se sanitiza y archiva
  en `auditorias/`, junto con la prueba real de Resend en dev.

## Bloqueantes previos (ratificados)

- **v1 B-1/B-2/B-3** (outbox durable, token fuera del scheduler, idempotencia+supersesión): confirmados.
- **v2 B-1** (tsc/build) y **v2 B-2** (`APP_BASE_URL` validada + HTML escapado): confirmados por el
  dictamen v3.

## Verificación (árbol limpio, con el driver presente)

```
npx tsc --noEmit    → 0
npx eslint convex/  → 0
npm run build       → exit 0
unit test plantillas → 30/30 (baseUrl, remitente, clasificación, escape/inyección, plantillas)
driver-45           → 15/15 (B-1/B-2/B-3, config-no-descarta-reanuda, terminal-descarta,
                              lease-recovery, backoff→descartado, revalidación, inerte)
```
Dev limpio tras la corrida (0 eventos, negocio QA cancelado, carlos activo).

## Pendiente (no bloqueante / externo)

- **Prueba en vivo real con Resend en dev** (obs. B-3.3 / OBS-3): con `RESEND_API_KEY` + `EMAIL_FROM`
  (`onboarding@resend.dev`) a un correo autorizado — invitación y recuperación reales,
  activación/restablecimiento, un 4xx terminal, un 429/5xx reintentable, y la **reanudación tras
  corregir una config** — sin registrar tokens ni claves. Requiere que el operador cree la cuenta.
- **Producción a terceros:** requiere **dominio verificado**. Desplegable **inerte** sin riesgo hasta
  entonces. Antes de desplegar: `QA_HELPERS` ausente en prod; `RESEND_API_KEY`/`EMAIL_FROM`/`APP_BASE_URL`
  solo como variables de Convex; Convex antes que el frontend; verificar contrato productivo; QA revocable.

## Higiene

Sin claves, tokens, `sub` ni correos reales en código, logs, reportes ni evidencia. La `RESEND_API_KEY`
vivirá solo en el entorno.
