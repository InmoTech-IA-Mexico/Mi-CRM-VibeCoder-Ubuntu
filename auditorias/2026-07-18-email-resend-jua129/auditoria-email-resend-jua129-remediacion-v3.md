# Acta de remediación — Integración de email (Resend, JUA-129) · v3

Fecha: 2026-07-18
Responde a: dictamen de **implementación v2 = NO-GO** (B-1 tsc/build; B-2 `APP_BASE_URL` sin validar).
Commits: implementación `2bb15ab` + remediación v2 `f852bca` (árbol limpio; ambos en `main`, sin desplegar).
Verificación: tsc 0 · eslint 0 · next build 0 · unit plantillas **22/22** · driver-45 **12/12**.

---

## Cierre de los bloqueantes v2

### B-1 — tsc/build fallaban (TS5097) → CORREGIDO

Diagnóstico confirmado: mi constancia previa de "0 errores" fue **estale** — corrí `tsc`/`build`
**antes** de crear el driver `tmp/drivers-jua129/test-plantillas.ts`, que importa
`../../convex/emailPlantillas.ts` con extensión `.ts`. El `tsconfig.json` incluía `**/*.ts` sin
`allowImportingTsExtensions` → TS5097 sobre ese archivo temporal.

Corrección (`f852bca`): se **excluye `tmp`** del `tsconfig.json` de la app. Es la exclusión deliberada
que sugería el dictamen: `tmp/` solo contiene drivers y evidencia desechables (gitignored, y eslint ya
lo ignora), nunca código de aplicación. **No** se habilitó `allowImportingTsExtensions` global (habría
tocado la semántica de imports de todo el proyecto por un driver). Reverificado con el driver presente:

```
npx tsc --noEmit   → 0 errores
npx eslint convex/ → 0 errores
npm run build      → ✓ Compiled successfully; exit 0
```

### B-2 — `APP_BASE_URL` sin validar antes de transportar tokens → CORREGIDO

Antes, `baseUrl()` solo recortaba barras y aceptaba cualquier cadena; el token se concatenaba y se
interpolaba en el `href` sin control. Corrección (`f852bca`):

- Nuevo **`normalizarBaseUrl(raw)`** en el módulo puro `emailPlantillas.ts` (testeable):
  parsea con `new URL`; **exige HTTPS**, salvo `http://localhost`/`127.0.0.1` para desarrollo; devuelve
  **solo el origen** (`u.origin`) → descarta cualquier path/query/fragmento, de modo que una base
  accidental o maliciosa no pueda inyectar nada en el enlace. `null` si falta o es inválida.
- `emailEnvio.baseUrl()` la usa; `flush` ya queda **inerte y no reclama** si la base es `null`
  (mismo trato que la key ausente → no quema intentos).
- **Defensa en profundidad:** el enlace se **escapa** (`escaparHtml`) al interpolarlo en el `href` y en
  el cuerpo del correo, aunque el origen normalizado + token hex ya no contengan comillas.
- Cobertura unit: `https` válido → origen; **descarta path/query/fragmento**; `http://localhost` OK;
  `http` no-local, cadena no parseable y vacío → `null`; intento de inyección
  `https://evil.com/"><script>` → `https://evil.com`. (7 aserciones nuevas, 22/22 en total.)

## Observaciones de escala (no bloqueantes) — aplicadas

- **Recuperación de leases acotada:** `reclamarLote` limita el barrido de `enviando` a un lote
  (`.take(LOTE_MAX)`) en vez de `collect()` — no escala con incidentes prolongados.
- **Retención de la outbox:** nueva `emailCola.purgarAntiguos` (eventos terminales
  `enviado`/`descartado` con > 7 días, por lotes) + cron diario `purgar-emails-antiguos` → la tabla no
  crece indefinidamente.

## Correcciones a la documentación (señaladas por el dictamen)

- **Semántica de idempotencia:** se reformula a **"entrega al menos una vez; deduplicación *best-effort*
  dentro de la ventana de 24 h de Resend"**. La frase absoluta "sin correos duplicados" era imprecisa:
  si la action envía, cae antes de registrar y la recuperación del lease ocurre > 24 h después, el
  proveedor ya no garantiza deduplicación (caso extremo, aceptado y documentado).
- **Conteo del driver:** son **12 aserciones / 0 fallos** en **10 grupos** (T3 y T5 tienen dos
  aserciones cada uno). La cifra correcta es 12/12; "10/10" se refería a los grupos.
- **Commit candidato:** el artefacto a auditar es `f852bca` (sobre `2bb15ab`), árbol limpio; `tmp/` es
  evidencia gitignored (no forma parte del artefacto desplegable).

## Estado de los bloqueantes de diseño v1 (ratificados por el dictamen v2)

- B-1 (recuperación durable), B-2 (token fuera del scheduler/fila, revalidación al reclamar),
  B-3 (idempotencia + supersesión): **remediados** en v2 y confirmados por el auditor.

## Pendiente (no bloqueante / externo)

- **Prueba en vivo con Resend real en dev** (obs.): con `RESEND_API_KEY` + remitente
  `onboarding@resend.dev` a un correo autorizado — invitación y recuperación, activación/restablecimiento,
  4xx terminal, 429/5xx reintentable, idempotencia observada sin registrar tokens. Requiere que el
  operador cree la cuenta de Resend.
- **Producción a terceros:** requiere **dominio verificado**. Desplegable **inerte** sin riesgo hasta
  entonces. Antes de desplegar: `QA_HELPERS` ausente en prod; `RESEND_API_KEY`/`EMAIL_FROM`/`APP_BASE_URL`
  solo como variables de Convex; Convex antes que el frontend.

## Higiene

Sin claves, tokens, `sub` ni correos reales en código, logs, reportes ni evidencia. La `RESEND_API_KEY`
vivirá solo en el entorno.
