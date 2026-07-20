# Acta de auditoría — Registro público autoservicio (JUA-39) · v1

Fecha: 2026-07-17
Commit candidato: `e7ea9e1` sobre `4bcaae1` (base productiva `6cb7dda`).
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Alcance acordado con el usuario: **activación inmediata ahora**; verificación de email **diferida a Resend**.

--------------------------------------------------------------------

## Qué resuelve

Permite que **cualquier negocio se dé de alta solo**, sin intervención del equipo técnico (el reverso
público de la CLI de JUA-41). Un formulario público crea el `Negocio` + su `Administrador` en un paso y
entra directo al CRM.

## Decisión de alcance (verificación de email)

El criterio de aceptación admite *"activa y lista para usar inmediatamente **(o tras verificar email)**"*.
La **verificación de email** (evitar cuentas fantasma) exige **enviar** correo, y el envío por **Resend
sigue pendiente** en el proyecto (las invitaciones son "copiar enlace", que no sirve para un desconocido
que se registra solo). Por eso se implementa **activación inmediata** (que cumple el criterio) y la
verificación de email queda como seguimiento atado a Resend.

## Cambios

**Backend — `convex/registro.ts` (mutation PÚBLICA `registrarNegocio`):**
- Args: `nombreNegocio, nombreAdmin, email, password, zonaHoraria`.
- **Validación:** nombre de negocio (≤80) y de persona (≤80) no vacíos; email con `EMAIL_RE`; contraseña
  ≥8; zona **IANA** (`Intl`). Reutiliza `negocios.validarNombre/validarZona/validarEmailAdminLibre`.
- **Unicidad global + aislamiento:** un email = un usuario; un `emailAdmin` = un negocio (índice
  `por_email_admin`). El negocio nace `activo` y **aislado** (tenant nuevo; todas las consultas se acotan
  por `negocioId`).
- **Anti-abuso (throttle GLOBAL):** máximo **5 registros por minuto** (lee los negocios más recientes por
  `_creationTime`). Al nivel del proyecto, que **no usa IP ni CAPTCHA**; la unicidad de email evita el
  spam con el mismo correo.
- Crea `negocios` + `usuarios` (admin activo, `passwordHash` scrypt) + `sesiones` (8 h) y devuelve la
  sesión para entrar directo (como `invitaciones.activar`).

**Frontend — `src/app/(auth)/registro/`:** formulario público (nombre de negocio, tu nombre, email,
contraseña ×2 con medidor de fortaleza, zona) → `registrarNegocio` → `guardarToken` → `/inicio`. Enlace
desde `/login` ("¿Nuevo negocio? Crea tu cuenta").

## Criterios de aceptación (JUA-39)

| Criterio | Cómo se cumple |
|---|---|
| Cualquiera crea un negocio sin contactar al equipo técnico | Ruta pública `/registro` + `registrarNegocio` |
| Cuenta activa e inmediata (o tras verificar email) | Admin `activo` + sesión → entra directo (verificación de email diferida a Resend) |
| Datos del negocio aislados de otros negocios | Tenant nuevo; consultas acotadas por `negocioId` (verificado: 0 fuga) |

## Verificación (dev, driver-40, 5/5)

Reporte `tmp/drivers-jua39/reporte-registro-publico-dev.txt`; negocios de prueba (`@test.mx`) **borrados**; sin secretos.

- **T1:** el registro crea negocio + admin `activo` + sesión (`sesionActual` resuelve al admin del negocio nuevo).
- **T2 (aislamiento):** la sesión nueva ve **0 clientes** (sin fuga del negocio demo).
- **T3 (7 guards):** rechaza email duplicado, email de usuario existente, email inválido, contraseña < 8,
  nombre de negocio vacío, nombre de persona vacío y zona IANA inválida.
- **T4 (throttle):** 5 registros/min permitidos; el **6º rechazado**.
- **UI:** `/registro` sirve **HTTP 200** con sus campos (smoke). La prueba E2E del formulario en navegador
  real (envío → auto-login → /inicio) se hará manualmente (no automatizable headless), como en JUA-33 B-4.

```txt
npx tsc --noEmit  OK    npx eslint  OK    npm run build  OK (26 rutas, incl. /registro)    convex dev --once  OK
```

## Observaciones / notas honestas

- **Verificación de email pendiente (Resend):** sin ella, un registro con email ajeno/falso crea una cuenta
  activa. Mitigado en parte por la unicidad global (no secuestra un email ya usado) y el throttle. Es la
  vía de seguimiento natural cuando Resend esté.
- **Enumeración de emails:** el registro revela si un email ya está en uso (inherente a todo alta). No se
  aplica la respuesta genérica de `recuperacion.ts` porque el formulario necesita reportar el conflicto.
- **Throttle global:** es una defensa coarse (sin IP/CAPTCHA); limita el abuso masivo pero no un atacante
  paciente. Suficiente para el nivel actual; endurecer (IP/CAPTCHA) si se abre a gran escala.

## Constancia

Módulo nuevo + ruta nueva; sin cambios de esquema. No desplegado, sin `git push`, sin tocar prod/remoto.
