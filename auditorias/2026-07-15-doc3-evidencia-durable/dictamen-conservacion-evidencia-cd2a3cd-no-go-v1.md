# Acta de dictamen — Conservación durable de evidencia (DOC-3) · v1

Fecha: 2026-07-15  
Commit auditado: `cd2a3cd`  
Base funcional: `6af3964`  
Estado: publicado en GitHub y construido por Railway  
Veredicto: **NO-GO DE CIERRE DOCUMENTAL — REMEDIACIÓN DE CREDENCIALES ACTIVAS REQUERIDA**

---

## Resultado del dictamen

La solución de conservación durable es correcta en estructura, fidelidad y alcance técnico: `auditorias/` está versionado, contiene la evidencia señalada por DOC-3 y no modifica la aplicación.

Sin embargo, no puede aprobarse la política de sanitización ni declararse DOC-3 cerrada porque el repositorio GitHub es **público** y contiene credenciales en texto claro de cuentas demo que continúan **activas en producción**, incluida una cuenta con rol administrador.

Que esas credenciales ya estuvieran presentes en `convex/seed.ts` convierte el riesgo en preexistente, pero no lo neutraliza. Copiarlas a más drivers y declarar segura su conservación perpetúa una exposición vigente.

No se requiere rollback funcional de `6af3964`. El bloqueo exige rotar o invalidar credenciales y sesiones, además de ajustar la política del archivo público.

## Hallazgo bloqueante

### B-1 — Credenciales productivas activas en repositorio público

La consulta en vivo a GitHub confirmó:

- Repositorio: `InmoTech-IA-Mexico/Mi-CRM-VibeCoder-Ubuntu`.
- Visibilidad: **PUBLIC**.
- Rama predeterminada: `main`.

La consulta de solo lectura a la tabla `usuarios` de Convex producción confirmó:

- `marta@demo.mx`: **activo**, rol **admin**.
- `carlos@demo.mx`: **activo**, rol **operativo**.
- `qa-bienvenida-admin@demo.mx`: **inactivo**.
- `qa-bienvenida-op@demo.mx`: **inactivo**.

Las credenciales de Marta y Carlos están declaradas en texto claro en `convex/seed.ts` y reaparecen en drivers versionados. Los identificadores de esas cuentas aparecen en diez drivers archivados.

Por tanto, cualquier persona con acceso a Internet puede obtener credenciales de cuentas activas de la aplicación productiva. La cuenta administrativa permite modificar datos y ejecutar capacidades reservadas al administrador del negocio demo.

Esta situación contradice la nota de sanitización de `auditorias/README.md`: una credencial no deja de ser sensible porque ya estuviera versionada previamente.

## Acciones requeridas antes de un nuevo dictamen

1. **Rotar inmediatamente** las contraseñas productivas de Marta y Carlos a valores aleatorios que no existan en el repositorio, o desactivar ambas cuentas si ya no son necesarias.
2. **Revocar todas las sesiones vigentes** de esas cuentas después de la rotación o desactivación.
3. Verificar que las contraseñas antiguas ya no permiten iniciar sesión.
4. Sustituir en la evidencia pública las credenciales activas por variables de entorno o marcadores sanitizados.
5. Ajustar `auditorias/README.md` para prohibir contraseñas, tokens y secretos vigentes, incluso si aparecieron antes en otra parte del repositorio.
6. Si se requiere conservar originales verbatim, guardarlos en almacenamiento privado con acceso restringido y publicar únicamente copias sanitizadas acompañadas de hashes de integridad.

### Importante sobre el historial Git

El commit ya está publicado en un repositorio público. Eliminar las cadenas en un commit posterior no invalida las copias existentes ni las elimina del historial.

La acción urgente es **rotar o desactivar las credenciales**. Una reescritura del historial puede evaluarse después por política, pero no sustituye la rotación.

Si las cuentas están destinadas deliberadamente a ser un acceso público de demostración, esa decisión deberá documentarse explícitamente y acompañarse de aislamiento, datos desechables, límites de capacidades administrativas y restauración automática. La evidencia actual no acredita ese modelo de sandbox público.

## Integridad del commit

### Parent y alcance

- `cd2a3cd` es hijo directo de `6af3964`.
- `HEAD`, `main` y `origin/main` apuntaban a `cd2a3cd` durante la auditoría.
- El árbol se encontraba limpio.
- El delta contiene 45 archivos, `+2721/−1`:
  - 44 archivos bajo `auditorias/`.
  - `eslint.config.mjs` con el ignore `auditorias/**` y la corrección de su comentario.
- No hay cambios en `src/`, `convex/`, schema ni configuración de runtime.

### Verificaciones locales

- `npx tsc --noEmit`: código 0.
- `npx eslint .`: código 0.
- Los 13 drivers JavaScript archivados pasan `node --check`.
- Los 43 artefactos copiados dentro de los tres ciclos coinciden byte por byte con sus fuentes locales; `auditorias/README.md` es el archivo nuevo restante.

### Railway

La consulta en vivo confirmó:

- Deployment `a78de906-164f-42e2-8994-ac38b74ad7e2`.
- Estado `SUCCESS`.
- Rama `main`.
- Commit completo `cd2a3cd26fc41c0fced61aed90f4270da53ba334`.

El despliegue no añade cambios funcionales, pero confirma que el repositorio publicado y Railway están alineados con el commit documental.

## Conservación durable

**Resultado técnico: CUMPLE.**

`git ls-tree` confirma que los 44 archivos de `auditorias/` forman parte del commit. Viajarán con un clon nuevo y ya no dependen de `tmp/`.

La estructura contiene:

- Actas de entrega.
- Los seis dictámenes del equipo auditor.
- Trece drivers JavaScript en total.
- Los dos reportes de JUA-36.
- Dieciséis capturas PNG.
- README de estructura y proceso.

Los dos reportes solicitados por DOC-3 están presentes y coinciden verbatim con los reportes revisados en el dictamen anterior.

## Revisión de secretos y datos

### Elementos confirmados como seguros

- Los dos usuarios QA de activación están inactivos en Convex producción.
- `resolverSesion` rechaza sesiones cuyo usuario esté inactivo, por lo que una sesión previa de esas cuentas no autoriza operaciones.
- Los reportes no contienen contraseñas ni tokens; la única mención de “tokens” indica explícitamente que fueron omitidos.
- El escaneo heurístico no encontró:
  - Claves privadas PEM.
  - Prefijos conocidos de GitHub, OpenAI, Slack, AWS o Linear.
  - `CONVEX_DEPLOY_KEY` o `RAILWAY_TOKEN`.
  - JWT literales.
  - URLs con usuario y contraseña embebidos.
- Las capturas son PNG válidos con las dimensiones documentadas.

### Limitaciones

El escaneo por patrones reduce riesgo, pero no demuestra ausencia absoluta de secretos de formato desconocido. La exposición de las credenciales activas ya confirmada es suficiente para el NO-GO.

Las capturas contienen datos del negocio demo —nombres, correos y teléfonos presentes también en el seed—. Si en futuros ciclos se usan datos reales, deberán anonimizarse antes de publicar el archivo.

## Fidelidad de evidencia

La copia verbatim queda acreditada: los 43 artefactos trasladados desde `tmp/` coinciden byte por byte con su fuente local y no se detectaron divergencias.

Conservar evidencia verbatim no obliga a publicar secretos. Una práctica compatible con integridad es:

- Conservar el original en un archivo privado.
- Publicar una copia sanitizada.
- Registrar el hash del original y el de la copia.
- Documentar exactamente qué campos fueron redactados y por qué.

## Observaciones documentales no bloqueantes

### OBS-1 — Conteo de drivers de Follow-ups

El acta declara nueve drivers de Follow-ups más README, pero la carpeta contiene ocho archivos `driver-1` a `driver-8` más su README.

El total global real es de trece drivers: ocho de Follow-ups, tres de JUA-36 y dos de JUA-37.

### OBS-2 — `estado-produccion.md` vuelve a mezclar commits

El encabezado local indica correctamente `cd2a3cd`, pero la tabla de infraestructura todavía declara:

- Railway `commitHash 6af3964`.
- `origin/main = 6af3964`.

La consulta viva confirma que ambos deben indicar `cd2a3cd`.

### OBS-3 — `git diff --check`

`git diff --check 6af3964..cd2a3cd` reporta espacios finales en encabezados de varios dictámenes Markdown. Corresponden al salto de línea duro de Markdown de dos espacios y proceden de copias verbatim.

No afecta ejecución ni fidelidad, pero significa que el delta no es estrictamente limpio para esa comprobación.

## Criterios para levantar el NO-GO

Un nuevo dictamen podrá conceder GO cuando exista evidencia de que:

1. Marta y Carlos fueron rotados o desactivados en producción.
2. Sus sesiones anteriores fueron revocadas.
3. Las credenciales antiguas ya no autentican.
4. La rama pública actual no añade nuevas credenciales vigentes y la política de `auditorias/` lo prohíbe.
5. Los originales que deban permanecer verbatim se conservan en un medio privado, o existe una aceptación formal y controles suficientes para un sandbox deliberadamente público.

No es necesario modificar ni redesplegar la funcionalidad de JUA-36 para cumplir estos puntos.

## Constancia de auditoría

Durante esta revisión no se modificó código, no se desplegaron funciones, no se hizo `git push`, no se cambiaron usuarios o sesiones y no se realizaron acciones en Linear. Se efectuaron consultas de lectura a Git, GitHub, Railway y Convex, verificaciones locales sin mutación funcional y la creación de esta acta dentro de `tmp/`.
