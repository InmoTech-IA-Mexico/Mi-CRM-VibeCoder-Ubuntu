# Acta de despliegue + verificación en producción — Alta automatizada de negocio (JUA-41)

Fecha: 2026-07-17
Commit desplegado: `6cb7dda` (main). Base previa en prod: `a99952f` (raíz `6a693cc`).
Convex prod: `glad-bird-297`. Dictamen habilitante: JUA-41 v2 = **GO con observaciones no bloqueantes**.

--------------------------------------------------------------------

## Orden ejecutado (condiciones del dictamen)

1. **Convex primero (cond. 1):** `npx convex deploy` con pseudo-TTY (push completo, no solo "Deployed"):
   funciones subidas, esquema validado y **añadido el índice `negocios.por_email_admin`**.
2. **Contrato verificado en prod (cond. 2):** `function-spec --prod` confirma `negocios.crearNegocio`,
   `reemitirAdminInicial`, `cancelarNegocioVacio`, `listarNegocios` (+ `qaBorrarNegocio` interno) y el índice.
3. **`QA_HELPERS` ausente en prod (cond. 3):** verificado (`env list --names-only`); `qaBorrarNegocio` queda
   **inerte** en prod.
4. **`git push` (cond. implícita):** `a99952f..6cb7dda`. Sin cambios de frontend (backend puro).

## Recorrido real en producción (cond. 4)

Con **negocio QA revocable** (`qa-alta-prod-…@test.mx`), no el demo, y **sin publicar tokens** (OBS-3).
Se eligió la **ruta de cancelación** (no activar) a propósito: `qaBorrarNegocio` es inerte en prod, así que
`cancelarNegocioVacio` deja prod **sin residuo**. Driver-39, **5/5 PASS**:

- `crearNegocio` → negocio + admin `pendiente`.
- `reemitirAdminInicial` → invalida el token viejo (`porToken` → `expirada`); el nuevo queda `pendiente`.
- `reemitirAdminInicial` con correo nuevo → `emailAdmin` corregido; invitación nueva para el correo nuevo.
- `cancelarNegocioVacio` → el negocio desaparece del listado.
- Verificación final: **sin negocios QA residuales** de la corrida. El negocio demo, intacto.

## Estado

JUA-41 **desplegado y verificado en producción**: alta de negocio y **soporte inicial** (reemisión,
corrección de correo, cancelación de alta vacía) **sin acceso directo a la BD** — los tres criterios de
aceptación. El bloqueante B-1 quedó cerrado (`6cb7dda`) y reconfirmado en prod.

Observaciones no bloqueantes vigentes: OBS-2 (ampliar limpieza QA si futuros drivers crean dependencias),
OBS-3 (tratar el enlace/token como credencial temporal), OBS-4 (N+1 de `listarNegocios` a revisar a escala).

## Constancia

Despliegue con GO del dictamen v2. Sin secretos en repo/drivers/actas; los tokens de activación no se
imprimieron ni se archivan. Producción quedó **sin residuos** (negocio QA cancelado; demo intacto).
Evidencia sanitizada a archivar en `auditorias/2026-07-17-alta-negocio-jua41/`.
