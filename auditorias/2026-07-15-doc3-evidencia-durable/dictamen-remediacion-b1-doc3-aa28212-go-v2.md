# Acta de dictamen — Remediación B-1 + cierre DOC-3 · v2

Fecha: 2026-07-15  
Commit auditado: `aa28212`  
Base documental: `cd2a3cd`  
Base funcional de JUA-36: `6af3964`  
Referencia: dictamen DOC-3 v1 = **NO-GO DE CIERRE DOCUMENTAL**  
Veredicto: **GO — B-1 RESUELTO Y DOC-3 CERRADO, CON OBSERVACIONES NO BLOQUEANTES**

---

## Resultado del dictamen

Se levanta el NO-GO del dictamen v1.

Las credenciales históricas publicadas de las cuentas demo activas fueron neutralizadas mediante rotación en producción y desarrollo; las sesiones de Marta y Carlos fueron eliminadas; las claves nuevas no se encuentran en el repositorio; y el seed ya no contiene ni puede restaurar las contraseñas expuestas.

La política de `auditorias/` prohíbe expresamente publicar secretos vigentes y establece un tratamiento correcto para evidencia verbatim.

Se considera **cerrada DOC-3**. No se requiere rollback de JUA-36 ni ninguna acción funcional inmediata sobre `6af3964`.

## Integridad del commit

- `aa28212` es hijo directo de `cd2a3cd`.
- `HEAD`, `main` y `origin/main` apuntaban a `aa28212` durante la auditoría.
- El árbol de trabajo se encontraba limpio.
- El delta contiene exactamente dos archivos y `+34/−12`:
  - `convex/seed.ts`.
  - `auditorias/README.md`.
- No hay cambios en `src/`, schema ni funciones públicas de la aplicación.
- `npx tsc --noEmit` terminó con código 0.
- `npx eslint .` terminó con código 0.
- `git diff --check cd2a3cd..aa28212` no reportó errores.

## Railway y repositorio

La consulta en vivo a Railway confirmó:

- Deployment `cefda488-7ff6-47a9-8fad-49cdf421b02d`.
- Estado `SUCCESS`.
- Rama `main`.
- Commit completo `aa282120e5cc4535ed815e443e252b095a17a21c`.

`tmp/estado-produccion.md` se encuentra alineado con `aa28212` tanto en el encabezado como en la tabla de infraestructura.

## Verificación de credenciales sin mutar autenticación

No se invocó `auth.iniciarSesion`, porque esa función incrementa intentos fallidos o crea sesiones. La validación se realizó offline contra los hashes scrypt actuales obtenidos mediante consultas de solo lectura.

### Credenciales históricas

Se recuperaron los dos valores históricos desde el parent público `cd2a3cd` y se verificaron con el mismo algoritmo y parámetros de `convex/auth.ts`.

Resultado:

- Credencial histórica de Marta frente al hash de producción: **no coincide**.
- Credencial histórica de Carlos frente al hash de producción: **no coincide**.
- Credencial histórica de Marta frente al hash de desarrollo: **no coincide**.
- Credencial histórica de Carlos frente al hash de desarrollo: **no coincide**.

Esto acredita la invalidez de las claves antiguas sin alterar contadores de bloqueo.

### Credenciales nuevas custodiadas

El archivo local `tmp/credenciales-demo-prod.txt`:

- Existe.
- Tiene permisos Unix `600`.
- Está excluido por `/tmp/` en `.gitignore`.
- No está rastreado por Git.
- Contiene cuatro candidatos de credencial, correspondientes a Marta/Carlos de prod y dev.

Sin imprimir ni registrar sus valores, se comprobó offline:

- Las dos credenciales de producción coinciden con los hashes actuales de Marta y Carlos.
- Las dos credenciales de desarrollo coinciden con los hashes actuales de Marta y Carlos.
- Ninguno de los cuatro valores aparece en el árbol Git de `aa28212`.

## Usuarios y sesiones

### Producción

La consulta de solo lectura a Convex confirmó:

- Marta: activa, admin, hash presente, **0 sesiones**.
- Carlos: activo, operativo, hash presente, **0 sesiones**.
- QA bienvenida admin: inactivo.
- QA bienvenida operativo: inactivo.
- `op-1783488882312@demo.mx`: inactivo.

Las tres sesiones restantes de producción pertenecen exclusivamente a esos usuarios QA inactivos. `resolverSesion` consulta el estado del usuario en cada operación y devuelve `null` para un usuario inactivo.

### Desarrollo

Se corroboró que Marta y Carlos están activos, tienen hash y **0 sesiones**.

Los cinco usuarios QA declarados —Verónica, Alberto, Rocío, Nadia y Aída— figuran inactivos.

## Variables de entorno

`npx convex env list --names-only` confirmó la presencia de `SEED_DEMO_PASSWORD` en:

- Convex producción.
- Convex desarrollo `merry-squirrel-978`.

No se consultaron ni mostraron los valores.

## Revisión del seed

### Sin secreto hardcodeado

`convex/seed.ts` ya no contiene el objeto de contraseñas demo ni un valor de respaldo.

`passwordInicialDemo()`:

- Lee exclusivamente `process.env.SEED_DEMO_PASSWORD`.
- Lanza un error explícito si la variable falta.
- No expone el valor.

### Solo al crear

Para Marta y Carlos, el hash se calcula únicamente en el operando derecho de `??`, dentro de `ctx.db.insert`.

El operador nullish es perezoso: si el usuario ya existe, no evalúa el insert ni `passwordInicialDemo()`. El patch posterior conserva el hash existente y ya no reinicia intentos ni bloqueo.

Por tanto, volver a ejecutar `poblarDemo` no restaura las credenciales históricas en usuarios existentes.

### Superficie de acceso

`poblarDemo` continúa siendo `internalMutation`; no forma parte del API público invocable desde el frontend.

## Política pública de auditoría

`auditorias/README.md` ahora establece correctamente:

- Prohibición de contraseñas, tokens o secretos vigentes, aunque ya hubieran aparecido antes.
- Variables de entorno para drivers nuevos.
- Reportes sin tokens ni contraseñas.
- Original privado y copia pública sanitizada cuando deba preservarse evidencia verbatim.
- Hash de integridad y lista de campos redactados.
- Neutralización en origen antes de publicar.
- Anonimización de datos personales reales.

La decisión de no reescribir el historial es aceptable después de la rotación: las cadenas históricas ya no autentican. Reescribir Git sería una decisión de política separada y no sustituiría la acción principal ya completada.

## Criterios del NO-GO v1

1. Marta y Carlos rotados o desactivados: **CUMPLE — rotados en prod y dev**.
2. Sesiones anteriores revocadas: **CUMPLE — cero sesiones de ambos usuarios**.
3. Credenciales antiguas no autentican: **CUMPLE — no coinciden offline con los cuatro hashes actuales**.
4. Rama pública sin credenciales vigentes nuevas y política expresa: **CUMPLE**.
5. Tratamiento de originales verbatim: **CUMPLE como política; ciclos existentes neutralizados en origen**.

## Observaciones no bloqueantes

### OBS-1 — Reactivación futura de usuarios QA

Los usuarios QA inactivos conservan su `passwordHash`. Además, al momento de la consulta:

- Dos sesiones QA de producción todavía no habían expirado.
- Cinco sesiones QA de desarrollo todavía no habían expirado.

Hoy son inertes porque `resolverSesion` rechaza usuarios inactivos. Sin embargo, `usuarios.reactivar` solo cambia `estado` a `activo`; no rota contraseña ni elimina sesiones. Reactivar uno de esos QA podría volver válidas una credencial conocida y una sesión todavía vigente.

**Sugerencia:** no reactivar cuentas QA archivadas. Si alguna debe reutilizarse, rotar primero su contraseña y eliminar todas sus sesiones. Como hardening futuro, hacer que `desactivar` elimine sesiones y que `reactivar` requiera un nuevo flujo de activación o cambio de contraseña.

### OBS-2 — Una sola contraseña inicial para dos roles

`SEED_DEMO_PASSWORD` se usa como contraseña inicial tanto para Marta como para Carlos cuando se crea un deployment desde cero.

No afecta las cuentas actuales, que ya tienen claves distintas rotadas, pero comparte secreto y amplía el impacto de una exposición inicial.

**Sugerencia:** usar variables separadas para admin y operativo, o generar credenciales iniciales independientes mediante un proceso privado.

### OBS-3 — Comentario histórico del seed

El comentario que antecede al nuevo helper todavía afirma que las contraseñas demo “se rehashean en cada seed; la contraseña no cambia”. Ya no describe la implementación: los hashes existentes no se tocan.

**Sugerencia:** corregir el comentario en una futura edición documental para evitar confusión.

### OBS-4 — Alcance temporal de la regla para drivers

El README dice en presente que “los drivers toman credenciales de variables de entorno”, mientras que los drivers históricos versionados conservan literales ya inertes por fidelidad.

**Sugerencia:** precisar “los drivers nuevos que se publiquen desde esta política” y mantener documentada la excepción histórica neutralizada.

## Dictamen de cierre

Se concede **GO** para mantener `aa28212` publicado y cerrar DOC-3.

- B-1 queda resuelto.
- La evidencia durable puede permanecer en el repositorio público.
- JUA-36 permanece cerrada.
- No se requiere rollback ni nueva liberación funcional.
- Las observaciones anteriores son de hardening y precisión documental, no bloqueantes.

## Constancia de auditoría

Durante esta revisión no se modificó código, no se desplegaron funciones, no se hizo `git push`, no se ejecutaron logins, no se cambiaron usuarios, sesiones o variables y no se realizaron acciones en Linear. Se efectuaron consultas de solo lectura a Git, Railway y Convex, verificaciones criptográficas offline sin revelar credenciales y la creación de esta acta dentro de `tmp/`.
