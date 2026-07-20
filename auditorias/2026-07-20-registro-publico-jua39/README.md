# Registro público autoservicio de nuevos negocios (JUA-39) — ciclo de auditoría y despliegue inerte

**Fecha:** 2026-07-20 (2.º intento; el 1.º fue NO-GO el 2026-07-17).
**Resultado:** diseño NO-GO×2 → **GO v3** con controles obligatorios → impl NO-GO (cuerpo sin acotar) →
**GO con observaciones** → **DESPLEGADO INERTE EN PROD** (no activado).
**Commit desplegado:** `013e70d` (rango `3048e00..013e70d`). **Base previa:** `b0e428f`.
**Prod:** Convex `glad-bird-297` + Railway. Registro público **cerrado** (inerte) hasta montar la infra.

## Qué se entregó

Registro público donde un negocio nuevo crea su cuenta sin el equipo técnico, con seguridad de endpoint
público sin sesión. Arquitectura **verificar-antes-de-crear** (cierra el NO-GO v1: ocupación de identidad):

- **Frontera (B-1):** Route Handler `src/app/api/registro/route.ts` bajo dominio proxeado por Cloudflare.
  Valida origen-edge (`X-Edge-Auth`, tiempo constante, rechazo antes de leer IP/cuerpo/Turnstile) + **cuerpo
  acotado a 8 KiB antes de parsear** + Turnstile, y llama a la httpAction `convex/http.ts` (guardada por
  `REGISTRO_SERVER_SECRET`) → `registro.crearPendiente` (**interna**, no pública). El navegador no puede
  crear altas directamente.
- **Verificar-antes-de-crear:** `crearPendiente` solo inserta un `registrosPendientes` (sin negocio/usuario
  ni reserva de email); la cuenta nace en `confirmar`, tras probar el buzón. Email por la cola durable de
  JUA-129 (tipo `verificacion_registro`).
- **Turnstile (B-2):** `src/lib/turnstile.ts` — Siteverify completo (success+hostname+action, cota 2048,
  timeout, idempotency_key, fail-closed incl. `timeout-or-duplicate`); `remoteip` de la frontera, no del payload.
- **Escala (B-3):** índices por tiempo (`por_token`/`por_email_creado`/`por_creado`/`por_expira`);
  throttle por email, fusible global y purga por **rango acotado**; cotas de input antes de `scrypt`;
  borrado-al-confirmar; supersesión por email en una transacción.
- **Frontend:** `/registro` (form + widget Turnstile) y `/registro/confirmar` (noindex/no-referrer/no-store,
  sin SessionProvider, limpia el token de la URL). Enlace desde `/login`. Todo **inerte** sin claves.

## Ciclo de auditoría

- **Diseño:** NO-GO v1 (activación inmediata) → NO-GO v2 (frontera evadible / Turnstile incompleto / índices) →
  **GO v3** con 6 controles obligatorios de implementación.
- **Implementación:** NO-GO v1 (cuerpo sin acotar antes de `JSON.parse`) → remediado (lectura acotada por
  bytes en ambas fronteras) → **GO con observaciones** (v2). OBS aplicadas: contador del unit test, cota del
  token a 64 hex, sin volcar el error crudo a consola.

## Verificación

- **Unit (`node --experimental-strip-types`):** `test-registro-unit.ts` — **21/21** (verificador Turnstile:
  success/hostname/action/timeout-or-duplicate/nulo; lectura acotada: Content-Length grande/mentiroso/stream
  que excede/exacto/vacío; plantilla: escape/inyección/enlace/24 h).
- **Backend (dev, QA_HELPERS=1):** `driver-46-registro.py` — **11/11** (B-1 solicitar no crea negocio/usuario,
  anti-enumeración, throttle, supersesión, fusible, confirmar+aislamiento, token usado, email ocupado en la
  espera, purga). Reporte en `drivers/`.
- **Prod inerte:** `/api/registro`→503, `/registro`→200 "no disponible", cabeceras de seguridad presentes,
  `/login` intacto. Detalle en `despliegue-registro-jua39-prod-2026-07-20.md`.

## Runbook de ACTIVACIÓN (pendiente — requiere el operador)

Hasta completarlo, el registro está **cerrado** (fallo cerrado). Pasos:

1. **Dominio proxeado en Cloudflare → Railway** (p. ej. `app.inmotechia.mx`, CNAME naranja). Servir la app
   (o al menos `/api/registro`) por ese host.
2. **Widget Turnstile** (site key + secret key) con `action = registro_negocio` y dominio = el anterior.
3. **Regla de Rate Limiting** de Cloudflare sobre `POST /api/registro` (por IP).
4. **Transform Rule** que **SET/REPLACE** el header `X-Edge-Auth: <EDGE_SECRET>` en ese host.
5. **Variables** (secretos ≥256 bits, distintos): `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` +
   `TURNSTILE_HOSTNAME` (Railway) · `EDGE_SECRET` (Cloudflare + Railway) · `REGISTRO_SERVER_SECRET`
   (Railway + Convex).
6. **Pruebas de integración** (paso 2 del dictamen): directo a la URL de Railway sin `X-Edge-Auth` → rechazo;
   cuerpo >8 KiB → 413 sin invocar Turnstile/Convex; Turnstile falla → no llega a Convex; rate-limit efectivo.
7. **Prueba viva** con un **tenant QA revocable**: registro real → correo de verificación (JUA-129) →
   confirmar → sesión 8 h → aislamiento. Limpiar el tenant y la evidencia. → **Done**.

## Nota

Secretos (Turnstile/edge/servidor) y contraseñas **no** se versionan. El código es inerte sin ellos.

## Archivos

- `diseno-registro-publico-jua39-v2.md`, `-v3.md` — diseño (NO-GO→GO).
- `auditoria-registro-publico-jua39-v1.md` — acta del 1.er NO-GO (activación inmediata, 2026-07-17).
- `auditoria-registro-publico-jua39-implementacion-v1.md`, `-v2.md` — implementación + remediación B-1.
- `despliegue-registro-jua39-prod-2026-07-20.md` — despliegue inerte.
- `drivers/` — driver-46 + unit + reporte sanitizado.
