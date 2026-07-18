# Acta de auditoría — Login con Google (JUA-40) · implementación completa · v3

Fecha: 2026-07-18
Commits auditados: `0e0dc92` + `39854f1` + `9f492c1` + `8082b99` + `60b1771`
Base productiva: `809fc94`
Referencia: dictamen v2 = GO con observaciones, pendiente de Client ID y prueba real
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES — AUTORIZADO SOLO EL DESPLIEGUE CONTROLADO**

---

## Resultado

Se ratifica JUA-40 para despliegue controlado. El alcance se mantiene acotado: Google es una credencial
alternativa para usuarios existentes, se vincula desde una sesión local válida, se resuelve por `googleSub` y
no crea cuentas ni usa email como identidad. La prueba real en dev cubre el riesgo que quedaba: GIS entrega
una credencial real, `google-auth-library` la valida, el vínculo se guarda, el login posterior crea sesión
sin contraseña y la desvinculación deja el estado limpio.

## Revisión de los controles

- **B-1, disponibilidad de nonce: RESUELTO.** No hay emisión pública ni cuota global. El cliente genera 128
  bits con `crypto.getRandomValues`; el servidor registra el nonce solo tras verificar el ID token.
- **Identidad estable: CONFORME.** Login busca `googleSub`; el vínculo se hace desde Perfil y rechaza que un
  sub pertenezca a otro usuario.
- **Replay y atomicidad: CONFORME.** Inserción de `noncesConsumidos` y la operación de sesión/vínculo en la
  misma internal mutation; el cruce login/vínculo también se rechaza.
- **Desvinculación: CONFORME.** `desvincularGoogle` exige sesión y `passwordHash` presente.
- **Cotas de entrada: CONFORME.** Rechaza `idToken` > 8192 y nonce vacío o > 128 antes de la biblioteca.
- **Higiene: CONFORME.** Sin logs de token/sub/email/payload; el reporte usa subs simulados.

## Observaciones no bloqueantes

1. **Evidencia viva durable.** Preservar un reporte sanitizado del ciclo real (incl. desvinculación) con
   fecha, entorno, pasos y resultado, sin tokens, sub, email ni Client ID.
2. **Cobertura del driver.** Añadir pruebas de rechazo por `idToken`/nonce sobredimensionados y de
   desvinculación (éxito con contraseña; estado posterior).
3. **UX de desvinculación.** Confirmación breve antes de desvincular.
4. **Escala de nonces consumidos.** Monitorear la tabla en producción; paginar o aumentar cadencia si crece.

## Salvaguardas para el despliegue

1. Configurar `GOOGLE_CLIENT_ID` (Convex prod) y `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Railway); no versionar estos
   valores con evidencias.
2. Desplegar Convex antes del frontend y verificar en prod esquema, cron y actions.
3. Cuenta QA revocable: vínculo desde Perfil, cierre de sesión, login Google, rechazo de credencial no
   vinculada y desvinculación.
4. Limpiar el vínculo y sesiones QA; archivar evidencia sanitizada en `auditorias/` antes de cerrar.

## Dictamen

`1ebeb48` puede avanzar a despliegue controlado y verificación en producción.
