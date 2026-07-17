# Acta de auditoría — Alta automatizada de negocio (JUA-41) · v1

Fecha: 2026-07-17
Commit auditado: `94342f9`
Base declarada: `a99952f` sobre producción `6a693cc`
Estado revisado: candidato local y Convex dev; no desplegado por esta auditoría
Veredicto: **NO-GO — B-1: EL ONBOARDING INICIAL NO TIENE RUTA DE RECUPERACIÓN SIN BASE DE DATOS**

---

## Resultado

La elección de una CLI mediante `internalMutation` es adecuada para un flujo de soporte de privilegio máximo. No expone una función pública al CRM y Convex permite ejecutar funciones internas desde la CLI o el Dashboard con credenciales de despliegue, no desde el cliente.

No procede desplegar aún. El camino nominal funciona, pero el primer admin puede quedar permanentemente pendiente sin una operación CLI para corregirlo. En ese caso el equipo vuelve a necesitar acceso directo a datos, justamente la dependencia que JUA-41 busca eliminar.

## Integridad y comprobaciones locales

- `94342f9` es hijo de `a99952f`; `origin/main` continúa en `a99952f` durante la auditoría.
- El delta contiene `convex/negocios.ts` nuevo y código generado de API: `+155` líneas, sin cambios de esquema ni de frontend.
- `git diff --check a99952f..94342f9` no reportó errores; el árbol estaba limpio al inicio.
- `npx tsc --noEmit` y `npx eslint .` terminaron correctamente.
- El primer `npm run build` no alcanzó Google Fonts por la restricción de red; el reintento autorizado compiló correctamente las 25 rutas.
- No se ejecutó el driver ni ninguna mutación de Convex, pues crean y borran datos en dev.

## Aspectos conformes

- `crearNegocio` es interna, valida argumentos, normaliza el correo y crea negocio e invitación dentro de una sola mutación (atómica).
- La invitación inicial usa 32 bytes aleatorios, expira a los siete días y el enlace solo se compone si el operador entrega `baseUrl`.
- La activación reutiliza el flujo ya existente: contraseña, zona horaria y creación del usuario admin.
- La consulta interna de listado no expone tokens.
- El driver y su reporte sanitizado declaran 10 PASS / 0 FAIL para creación, activación, listado, cuatro validaciones negativas y limpieza del caso nominal.

## B-1 — Negocio pendiente irrecuperable desde la CLI

**Estado: ABIERTO — BLOQUEANTE.**

Después de una creación correcta, cualquiera de estas situaciones deja una entidad persistente que la CLI no puede recuperar:

1. La invitación inicial expira a los siete días.
2. Se capturó un correo equivocado para el primer administrador.
3. Antes de activar, otra operación crea una cuenta global con ese correo; `invitaciones.activar` rechaza la activación.

`crearNegocio` siempre rechaza un `emailAdmin` ya presente en `negocios`, sin considerar que la invitación esté expirada, aceptada o inválida. `listarNegocios` puede mostrar `sin_invitacion`, pero solo informa el problema: no existe una mutación interna para renovar la invitación, cambiar el correo del admin inicial o cancelar de forma segura un negocio que aún no tiene datos.

`usuarios.reenviar` no resuelve el caso porque exige una sesión admin del negocio, precisamente inexistente en este estado. Crear otro negocio con otro correo tampoco corrige el primero y genera una duplicidad de negocio.

### Remediación requerida

Incorporar una operación interna de soporte —por ejemplo `reemitirAdminInicial`— que:

- Reciba `negocioId`, correo de admin opcional y `baseUrl`.
- Solo opere si el negocio no tiene un admin activo.
- Valide y normalice el correo, y compruebe la unicidad global frente a `usuarios`.
- Invalide las invitaciones iniciales pendientes/expiradas que correspondan, actualice `negocios.emailAdmin` cuando se corrige el correo y cree una invitación admin nueva de un solo uso con vigencia definida.
- Devuelva el enlace sin registrar el token en reportes o logs.
- Rechace explícitamente el reenvío si ya existe un admin activo.

Alternativamente, una operación interna de cancelación segura de un negocio todavía vacío puede complementar el reenvío.

La evidencia de remediación debe incluir: expiración o invalidación de la primera invitación, reemisión, cambio de correo, rechazo de negocio con admin activo y ausencia de invitaciones pendientes paralelas.

## Observaciones no bloqueantes

- **OBS-1** — `zonaHoraria` y `baseUrl` aceptan cualquier cadena; validar zona IANA y exigir baseUrl https.
- **OBS-2** — la comprobación de `emailAdmin` recorre la tabla con `filter`; conviene un índice `por_email_admin` y revisar el N+1 del listado.
- **OBS-3** — `qaBorrarNegocio` acepta cualquier ID; restringir a negocios QA y documentar su limpieza.

## Dictamen

No desplegar `94342f9`. La corrección de B-1 debe permitir recuperar un alta inicial fallida sin acceso directo a la BD; una vez cubierta con pruebas negativas y de limpieza, procede una nueva revisión.
