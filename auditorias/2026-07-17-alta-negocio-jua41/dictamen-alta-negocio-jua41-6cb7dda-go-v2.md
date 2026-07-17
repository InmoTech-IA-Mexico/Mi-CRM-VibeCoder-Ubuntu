# Acta de auditoría — Alta automatizada de negocio (JUA-41) · v2

Fecha: 2026-07-17
Commits auditados: `94342f9` + `6cb7dda`
Base productiva: `6a693cc`
Estado revisado: candidato local y Convex dev; no desplegado por esta auditoría
Referencia: dictamen v1 = **NO-GO** por B-1
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES**

---

## Resultado

Se levanta el NO-GO de JUA-41. La remediación proporciona una ruta de soporte interna para recuperar el onboarding del primer administrador sin editar la base de datos: reemite la invitación, permite corregir el correo y permite cancelar de forma acotada un alta aún vacía.

La elección de `internalMutation` mantiene estas capacidades fuera de la API del cliente.

## Integridad y comprobaciones locales

- `6cb7dda` es hijo directo de `94342f9`; `origin/main` permanecía en `a99952f` durante la auditoría.
- Delta: `convex/negocios.ts` y `convex/schema.ts`; añade el índice `negocios.por_email_admin`.
- `git diff --check 94342f9..6cb7dda` sin errores; árbol limpio.
- `npx tsc --noEmit`, `npx eslint .` y `npm run build` correctos (25 rutas tras reintento por Google Fonts).
- No se ejecutaron drivers ni mutaciones; sin despliegue, `git push` ni acciones en Linear.

## Revisión del bloqueante B-1

**Estado: RESUELTO.**

`reemitirAdminInicial`:
- Rechaza el negocio inexistente y cualquiera que ya tenga un administrador activo.
- Usa el correo actual o uno corregido, lo normaliza y revalida contra `usuarios.por_email` y `negocios.por_email_admin`, excluyendo el propio negocio.
- Invalida todas las invitaciones administrativas pendientes antes de crear una nueva; el token anterior deja de servir y no quedan invitaciones paralelas.
- Actualiza `emailAdmin` cuando procede y devuelve el nuevo enlace sin persistir el token fuera de la invitación.

`cancelarNegocioVacio` complementa la recuperación: solo elimina un negocio sin usuarios ni clientes y borra sus invitaciones. No permite borrar un negocio ya utilizado.

Con ello se cubren los tres casos que bloqueaban v1: vencimiento, correo equivocado y correo ocupado antes de activar.

## Evidencia revisada

`driver-38-recuperacion-negocio.py` y su reporte declaran **10 PASS / 0 FAIL**. Cubren reemisión e invalidación, corrección de correo, rechazo con admin activo, correo ocupado y recuperación con libre, cancelación de negocio vacío y rechazo con usuario, y validación de zona IANA y baseUrl. El driver nominal también declara 10 PASS / 0 FAIL.

## Observaciones no bloqueantes

- **OBS-1** — El acta candidata dice «9/9» pero el reporte tiene 10 PASS / 0 FAIL; alinear el texto. R1 invalida por reemisión, no fuerza los siete días; una prueba futura puede marcar una invitación como expirada para el caso literal.
- **OBS-2** — `qaBorrarNegocio` limita a `@test.mx` y `QA_HELPERS`; si futuros drivers crean otras dependencias, ampliar o rechazar la limpieza.
- **OBS-3** — El token/enlace de activación es una credencial temporal: no pegarlo en tickets, reportes o actas; usar solo el origen https productivo como `baseUrl`.
- **OBS-4** — `listarNegocios` conserva un patrón N+1; revisar si crece el número de negocios.

## Condiciones para despliegue

1. Desplegar primero Convex (índice y funciones antes de usarlas).
2. Verificar en prod las firmas de `crearNegocio`, `reemitirAdminInicial`, `cancelarNegocioVacio`, `listarNegocios` y el índice.
3. Confirmar `QA_HELPERS` ausente en producción.
4. Recorrido en prod con negocio QA revocable: crear, reemitir, cambiar correo, activar o cancelar, y limpiar sin publicar el token.
5. Archivar el reporte sanitizado en `auditorias/` antes de marcar JUA-41 Done.

## Dictamen

`6cb7dda` puede avanzar a despliegue controlado y verificación en producción. No se requiere una corrección funcional previa.
