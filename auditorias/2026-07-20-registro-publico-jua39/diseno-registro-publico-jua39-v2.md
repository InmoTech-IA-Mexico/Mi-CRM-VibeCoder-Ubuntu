# Diseño — Registro público autoservicio de nuevos negocios · JUA-39 · v2

Fecha: 2026-07-19 · Proyecto "InmoTech IA México — Resto del PRD" · Prioridad Medium.
Referencia: **dictamen v1 = NO-GO** sobre `e7ea9e1` (activación inmediata sin verificar email).
Habilitadores nuevos: **JUA-129** (email transaccional Resend, activo en prod) + estamos en **Cloudflare**
(Turnstile gratis). Enfoque: como JUA-40/129 — **construir e implementar inerte** (sin claves de Turnstile
la ruta queda deshabilitada), y activar cuando el operador cree el widget.

---

## 1. Objetivo y por qué cambia el enfoque

Permitir que un negocio nuevo cree su cuenta **sin intervención del equipo técnico** (hoy: alta manual por
CLI, JUA-41). El criterio funcional admite "activa inmediatamente **o tras verificar email**"; el dictamen v1
exige la **segunda** variante por seguridad. Este diseño **verifica la propiedad del email ANTES de crear
cuenta** y añade **antiabuso por origen verificable**.

## 2. Respuesta directa al NO-GO v1

| Bloqueante v1 | Causa | Remediación de este diseño |
|---|---|---|
| **B-1** ocupación de identidad de email | Creaba admin activo + reservaba el email (único global) para un correo **no demostrado** | **Verificar-antes-de-crear**: `solicitar` NO crea negocio/usuario; solo un **registro pendiente** con token. La cuenta se crea en `confirmar`, tras probar control del buzón. La unicidad global se reserva **solo al confirmar**. |
| **B-2** antiabuso global eludible / DoS del alta | Tope global (5 últimas filas de `negocios`) bloqueaba TODA la app 1 min y era eludible | **Capas**: (1) **Turnstile** verificado en servidor (secreto en entorno); (2) throttle **por email**; (3) cuota global **alta** como cortacircuito (no bloquea a terceros); (4) el flood ya no crea negocios reales, solo filas pendientes baratas y purgables; (5) regla de rate-limit en el **edge de Cloudflare** sobre `/registro`. |

## 3. Flujo seguro (dos pasos, email verificado antes de crear nada durable)

```
1. /registro  (público, con widget Turnstile)
   nombreNegocio · tu nombre · email · contraseña (x2) · zona horaria · [Turnstile]
        │  registro.solicitar (ACTION Node)
        ▼
   ── verifica el token de Turnstile con Cloudflare (secreto en entorno) ──
        │  (si falla → rechaza; si Turnstile no está configurado → ruta deshabilitada)
        ▼
   registro.crearPendiente (internal mutation):
     · valida nombre/persona/contraseña(≥8)/zona (IANA)
     · throttle POR EMAIL (no reemitir si hay uno reciente)
     · cuota global alta (cortacircuito)
     · NO crea negocio ni usuario → inserta `registrosPendientes`
       {nombreNegocio, nombreAdmin, email, passwordHash, zona, token, expiraEn}
     · encola email de verificación (JUA-129, tipo "verificacion_registro")
        │
        ▼
   Respuesta SIEMPRE genérica: "Si el email es válido, te enviamos un enlace." (anti-enumeración)

2. Email → enlace  /registro/confirmar?token=…
        │  registro.confirmar (mutation pública)
        ▼
     · valida token (existe, no usado, no expirado)
     · REVALIDA unicidad global del email AHORA (pudo ocuparse entre paso 1 y 2)
     · crea negocio (activo) + admin (activo, passwordHash del pendiente) + sesión  [atómico]
     · marca el pendiente usado
        │
        ▼
   Entra directo al CRM como administrador (sesión 8 h). Negocio aislado desde el primer momento.
```

## 4. Cierre de B-1 — verificación real de email

- `solicitar` **no** crea negocio/usuario ni reserva el email; solo un `registrosPendientes` (efímero,
  purgable). Un atacante que "registre" `victima@correo.mx` **no ocupa** su identidad: la cuenta solo nace en
  `confirmar`, que exige el **token entregado a ese buzón** (que el atacante no controla). La víctima puede
  registrarse normalmente; gana quien confirma, y la unicidad se valida **en `confirmar`**.
- El `token` es aleatorio (32 bytes), **un solo uso**, expira en 24 h. Se transporta por el buzón, no por el
  scheduler ni logs (mismo criterio que JUA-129).
- Alineado con OWASP (verificar propiedad del correo antes de habilitar la cuenta).

## 5. Cierre de B-2 — antiabuso por origen verificable, en capas

1. **Turnstile (Cloudflare) verificado en servidor.** `registro.solicitar` es una **action Node** que hace
   `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` con `TURNSTILE_SECRET_KEY` (solo en
   entorno) + el token del widget. Si no `success` → rechaza. El frontend no puede falsificarla.
   **Sin `TURNSTILE_SECRET_KEY` la ruta queda deshabilitada** (fallo cerrado, despliegue inerte seguro).
2. **Throttle por email.** No se reemite verificación para el mismo email si hay un pendiente reciente
   (ventana ~5 min), como el throttle de recuperación (JUA-7).
3. **Cuota global alta = cortacircuito**, no el control principal ni un lock que bloquee a terceros: un umbral
   por ventana suficientemente alto para no afectar tráfico legítimo; si se supera, se rechazan **nuevas**
   solicitudes (sin tocar las ya emitidas). Reemplaza el bucket global de 5 que bloqueaba a todos.
4. **El flood ya no crea negocios reales.** Antes, 5 req/min creaban 5 negocios; ahora crean, como mucho,
   filas `registrosPendientes` (baratas), que un **cron purga** al expirar. Nada se activa sin confirmar.
5. **Edge (Cloudflare).** Regla de **rate-limiting/WAF** sobre `/registro` (por IP/ASN) como capa de red — el
   proyecto ya usa Cloudflare. Se documenta como configuración de operación (no código de la app).
6. **Telemetría** de intentos (conteos/resultados) **sin** almacenar contraseñas ni tokens.

## 6. Observaciones del dictamen v1

- **OBS-1 (enumeración):** `solicitar` responde **siempre** genérico; si el email ya tiene cuenta, no se crea
  pendiente ni se revela el motivo (el detalle solo en logs internos, sin PII sensible). La UI muestra el mismo
  mensaje en ambos casos.
- **OBS-2 (evidencia UI):** el driver ejercerá el **flujo completo** (solicitar → pendiente → confirmar →
  sesión → aislamiento), con limpieza; y prueba de navegador del formulario si el entorno lo permite.
- **OBS-3 (fortaleza de contraseña):** se reutiliza el medidor existente (JUA-124) + regla ≥8. **Mejora
  opcional** (no bloqueante): verificación de contraseña comprometida (HIBP k-anonymity) — se deja como OBS
  futura, como indicó el propio dictamen.

## 7. Esquema y módulos

- **`registrosPendientes`** (tabla nueva): `nombreNegocio`, `nombreAdmin`, `email`, `passwordHash` (hasheada
  al solicitar, nunca en claro), `zonaHoraria`, `token`, `expiraEn`, `usadoEn?`, `creadoEn`. Índices
  `por_token` y `por_email` (throttle). Un cron purga los expirados/usados.
- **`emailsSalientes` (JUA-129):** se extiende el `tipo` con `"verificacion_registro"` + referencia opcional
  `registroPendienteId`. `reclamarLote`/revalidar derivan destinatario+token del pendiente vigente; nueva
  plantilla "Confirma tu registro" (enlace `/registro/confirmar`, 24 h). Reutiliza toda la cola durable.
- **`convex/registro.ts`** (runtime por defecto): `crearPendiente` (internal), `confirmar` (public mutation),
  `porToken` (query para la pantalla de confirmación), `purgarPendientes` (internal, cron). QA gateado.
- **`convex/registroAccion.ts`** (`"use node"`): `solicitar` (public action) — verifica Turnstile y llama a
  `crearPendiente`. Patrón de `googleAction.ts`/`emailEnvio.ts`.
- Reutiliza `validarNombre`/`validarZona`/`validarEmailAdminLibre` de `negocios.ts` y `hashPassword` de
  `auth.ts`.

## 8. Configuración / entorno (nunca en el repo)

| Variable | Dónde | Nota |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | Convex prod/dev | **Secreta.** Sin ella, `/registro` deshabilitado (inerte). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Railway | Pública (widget). Sin ella, el formulario no se muestra. |
| (email) | ya configurado | Reutiliza la infraestructura de JUA-129 (Resend, dominio `inmotechia.mx`). |

Dependencia externa: el operador crea un **widget Turnstile** en Cloudflare (gratis; ya usa Cloudflare). Como
JUA-40 (Client ID) y JUA-129 (dominio), es **desplegable inerte** sin las claves.

## 9. Frontend

- **`/registro`** (grupo `(auth)`): formulario (negocio, tu nombre, email, contraseña x2 + medidor JUA-124,
  zona) + **widget Turnstile**. Validación de formato en cliente **antes** de llamar (para no gastar el token
  de Turnstile en errores triviales; el servidor revalida). Al enviar → `registro.solicitar` → pantalla
  "Revisa tu correo". Oculto si no hay `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- **`/registro/confirmar`**: lee el token, llama `registro.confirmar`; éxito → guarda la sesión y va a
  `/inicio`. Maneja expirado/usado/email-ya-ocupado con avisos claros.
- Enlace desde `/login` ("¿Nuevo negocio? Regístrate"), visible solo si el registro está habilitado.

## 10. Aislamiento (criterio de aceptación)

El negocio nuevo es un **tenant nuevo** (`negocioId` propio); todo el acceso se deriva de la sesión ligada a
ese `negocioId` (modelo ya auditado, JUA-10/43). La sesión emitida en `confirmar` no deriva acceso a ningún
otro negocio. El driver lo comprobará.

## 11. Verificación prevista

- **Núcleo (dev):** driver que ejercita solicitar (con Turnstile simulado/gateado en dev) → pendiente →
  confirmar → sesión del nuevo negocio → **aislamiento** (no ve el negocio demo) → casos negativos: token
  usado/expirado, email ya ocupado (en solicitar Y en confirmar), throttle por email, respuesta genérica
  (anti-enumeración), y **ausencia de creación de negocio en `solicitar`** (clave del cierre de B-1).
- **Turnstile:** verificación de `siteverify` con clave inválida → rechazo (transporte simulado/función pura
  para la clasificación; prueba real con clave de test de Cloudflare).
- **UI (OBS-2):** prueba de navegador del formulario completo si el entorno lo permite.
- **Inerte:** sin `TURNSTILE_SECRET_KEY`, `solicitar` rechaza y `/registro` no se muestra.
- lint/tsc/build 0.

## 12. Decisiones a confirmar

1. **Verificar-antes-de-crear** (2 pasos: solicitar → confirmar), NO activación inmediata. ✅/✍️
2. **Turnstile (Cloudflare)** como antibot server-verified; ruta **inerte** sin sus claves. ✅/✍️
3. **Contraseña en el paso 1** (guardada hasheada en el pendiente) para que confirmar sea un clic. Alternativa:
   pedirla en el paso 2. ✅/✍️
4. **Reutilizar la cola durable de JUA-129** para el email de verificación (nuevo tipo). ✅/✍️
5. **Rate-limit de edge en Cloudflare** sobre `/registro` como capa adicional (config de operación). ✅/✍️
