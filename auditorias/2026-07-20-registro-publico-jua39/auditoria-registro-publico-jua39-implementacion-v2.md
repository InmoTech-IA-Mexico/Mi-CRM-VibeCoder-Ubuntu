# Acta de remediación — Registro público autoservicio (JUA-39) · implementación v2

Fecha: 2026-07-20
Responde a: dictamen de implementación v1 = **NO-GO** (B-1: cuerpo sin límite antes de parsear JSON).
Commit: `013e70d` (sobre `3048e00`). Rango candidato: `3048e00..013e70d` (impl + remediación B-1).
Verificación: tsc 0 · eslint 0 · next build 0 · unit **21/21** · driver-46 (backend) **11/11**.

---

## Cierre del bloqueante B-1

**Problema:** el Route Handler ejecutaba `request.json()` (materializando el cuerpo completo) **antes**
de acotar tamaño o verificar Turnstile → un JSON enorme al host público consumía memoria/CPU antes del
rechazo. Igual riesgo, en profundidad, en la httpAction de Convex.

**Remediación (`013e70d`):** lectura **acotada por bytes** antes de parsear, en **ambas fronteras**.

- **`src/lib/http-body.ts` · `leerCuerpoAcotado(body, max, contentLength)`** (puro, testeable):
  1. Rechazo **temprano** si `Content-Length` ya supera el máximo, **sin confiar solo en él**.
  2. Lee el `ReadableStream` **por fragmentos** con un **contador de bytes**; al rebasar el máximo,
     `reader.cancel()` y devuelve `null` (→ **413**), sin decodificar ni `JSON.parse`.
  3. Fail-closed ante error de lectura (`null`).
- **Route Handler (`route.ts`):** orden **borde → cuerpo acotado (8 KiB → 413) → Turnstile → Convex**.
  **No** se llama a Siteverify ni a Convex si el cuerpo excede el máximo (la lectura acotada retorna
  antes). 8 KiB es holgado para todos los campos máximos + el token de Turnstile (≤2048).
- **httpAction (`convex/http.ts`):** misma defensa **inline** (Convex no puede importar de `src/`):
  tras validar el secreto, lee acotado (8 KiB) antes de `JSON.parse`. Defensa en profundidad aunque
  esté protegida por `REGISTRO_SERVER_SECRET`.

**Pruebas de lectura acotada (estáticas)** — unit `test-registro-unit.ts` (6 nuevas):
- `Content-Length` > max → `null` (rechazo temprano).
- Stream que supera el máximo **sin** `Content-Length` → `null` (conteo por bytes).
- `Content-Length` mentiroso (pequeño) + stream grande → `null` (no se confía solo en el header).
- Cuerpo pequeño válido → devuelve el texto; exactamente el máximo → devuelve; sin body → `""`.

Prueba dinámica de que **Turnstile/Convex no se invocan** cuando el cuerpo excede: garantizada por el
**orden** (413 retornado antes de `verificarTurnstile`/`fetch` a Convex); se ejercitará también en la
integración del handler con el entorno configurado (paso 2 de la prueba mínima).

## Observaciones no bloqueantes (aplicadas)

- **`console.error` de la confirmación:** eliminado el volcado del error crudo; se conserva solo el
  mensaje sanitizado en la UI.
- **Cota del `token`:** `porToken` y `confirmar` validan `^[0-9a-f]{64}$` **antes** de consultar el
  índice (higiene/coste).

## Estado (ratificado por el dictamen v1) — sin cambios

Frontera + secretos (comparación en tiempo constante, rechazo antes de IP/Turnstile), contrato Turnstile,
pendiente/confirmación atómica, outbox `verificacion_registro` con supersesión, índices por tiempo + purga
por lote, cotas antes de `scrypt`, cabeceras `no-referrer`/`noindex`/`no-store` y limpieza del token de la
URL: **conformes**.

## Prueba mínima — estado

1. **Unit Turnstile + lectura acotada + plantilla — HECHO** (21/21).
2. **Integración del handler** (directo a Railway sin header → rechazado; header de cliente no sustituye al
   inyectado; Turnstile falla → no llega a Convex; **cuerpo > límite → 413 sin Turnstile/Convex**) —
   **PENDIENTE**: con la frontera Cloudflare + claves de prueba de Turnstile (previo a la activación).
3. **Driver de servidor — HECHO** (driver-46 **11/11**).
4. **Prueba viva controlada — PENDIENTE** (dominio naranja + regla de límite + widget + correo real).

Pasos 2 y 4 se ejecutan al activar (con la infra de Cloudflare), como en JUA-40/129. Inerte hasta entonces.

## Higiene

Contraseña solo hasheada; tokens/secretos nunca versionados ni en logs. La `RESEND_API_KEY` de dev se
quitó y restauró durante el driver (flush inerte determinista) sin exponerla.
