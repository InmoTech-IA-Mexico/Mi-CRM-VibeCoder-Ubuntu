# Acta para dictamen — Remediación B-1 + cierre DOC-3 · v2

Fecha: 2026-07-15
Commit candidato: `aa28212` (sobre `cd2a3cd`) — **publicado**; Railway SUCCESS con `aa28212`
Referencia: dictamen DOC-3 v1 = **NO-GO DE CIERRE DOCUMENTAL** por B-1 (credenciales activas en
repositorio PÚBLICO). Sin objeción funcional a `6af3964`.
Veredicto: **PENDIENTE DE DICTAMEN**

--------------------------------------------------------------------

## Respuesta al hallazgo bloqueante B-1 — las 6 acciones requeridas

**1. Rotación inmediata — HECHA (prod Y dev).**
Contraseñas de `marta@demo.mx` y `carlos@demo.mx` rotadas a valores aleatorios de 20 caracteres
(generados con `openssl rand`, no presentes en el repositorio ni en esta acta), usando el flujo
real del producto (`auth.cambiarPassword`). Se remedió también el deployment de **desarrollo**
(`merry-squirrel-978`): su nombre y las credenciales de sus usuarios QA también constaban en la
evidencia pública, así que se rotaron marta/carlos de dev y se revocaron los 5 usuarios QA de dev
(verónica, alberto, rocío, nadia, aída). En prod se revocó además el QA antiguo
`op-1783488882312@demo.mx`, que seguía activo con una sesión viva.

**2. Revocación de sesiones — HECHA.**
`cambiarPassword` revoca todas las demás sesiones del usuario al rotar (comportamiento de JUA-120);
las sesiones de rotación y de verificación se cerraron con `cerrarSesion`. Comprobado en la tabla
`sesiones` de prod: **cero sesiones de marta/carlos**. Las 3 filas restantes pertenecen a usuarios
QA ya inactivos → inertes, porque `resolverSesion` rechaza usuarios inactivos (confirmado por el
propio dictamen).

**3. Las contraseñas antiguas ya no autentican — VERIFICADO.**
`auth.iniciarSesion` en prod con `Marta1234` → `ok: false` · con `Carlos1234` → `ok: false`.
Con las claves nuevas → autentican (sesiones de prueba cerradas de inmediato). Ídem en dev.

**4. La rama pública no añade credenciales vigentes — HECHO + MINA DESACTIVADA.**
Tras la rotación, todas las cadenas de credenciales presentes en el repositorio (seed histórico,
drivers archivados) quedaron **inertes**. Además se eliminó el riesgo de reactivación:
`seed:poblarDemo` re-aplicaba la contraseña hardcodeada a usuarios EXISTENTES en cada ejecución
(una re-siembra habría restaurado las claves expuestas). En `aa28212` el seed: (a) toma la
contraseña inicial de la env var `SEED_DEMO_PASSWORD` del deployment (sin fallback en código;
configurada en prod y dev con valores aleatorios distintos), y (b) **solo la aplica al CREAR** el
usuario — nunca pisa la de uno existente. **Probado en dev:** re-ejecución de `poblarDemo` → la
clave vieja sigue sin autenticar y la rotada sigue funcionando.

**5. Política del archivo público — ACTUALIZADA (`auditorias/README.md`, en `aa28212`).**
Prohíbe secretos VIGENTES aunque ya estuvieran en otra parte del repo; drivers con credenciales por
variables de entorno; neutralización en origen antes de copiar evidencia (rotar/revocar/invalidar);
anonimizar datos personales reales en capturas.

**6. Originales verbatim con secretos — POLÍTICA ADOPTADA.**
Para el futuro: original en medio privado + copia sanitizada publicada con hash de integridad y
lista de campos redactados. Para los ciclos ya publicados no se reescribió nada: la vía elegida fue
neutralizar los secretos en origen (rotación/revocación), como permite el propio dictamen.

**Sobre el historial git:** siguiendo el dictamen, NO se reescribió el historial — la rotación es
la acción eficaz (las copias del historial contienen ya solo credenciales muertas). Si por política
se quisiera reescribir más adelante, es una decisión separada del responsable.

**Custodia de las claves nuevas:** SOLO en `tmp/credenciales-demo-prod.txt` (local, `chmod 600`,
fuera de git) — prod y dev. `estado-produccion.md` ya no contiene contraseñas en claro (apunta a
ese archivo). Los valores de `SEED_DEMO_PASSWORD` viven solo en los deployments de Convex.

--------------------------------------------------------------------

## Observaciones documentales del dictamen v1

- **OBS-1 (conteo de drivers):** corregido en el acta v1 local: followups = **8 drivers + README**
  (total global 13 drivers: 8 + 3 + 2, como precisó el dictamen).
- **OBS-2 (hashes en `estado-produccion.md`):** tabla de infraestructura y encabezado alineados al
  commit vigente `aa28212` (Railway SUCCESS verificado con ese hash).
- **OBS-3 (espacios finales en dictámenes copiados):** sin acción — son el salto de línea duro de
  Markdown de los dictámenes verbatim del auditor; se registra como característica esperada de las
  copias fieles.

--------------------------------------------------------------------

## Integridad del delta `cd2a3cd..aa28212`

- 2 archivos, +34 −12: `convex/seed.ts` (endurecimiento descrito) y `auditorias/README.md`
  (política). **Sin cambios funcionales de la app** (el seed es `internalMutation`, fuera del API
  público).
- `npx tsc --noEmit` y `npx eslint .` en 0. Convex desplegado a dev y prod; `git push` hecho;
  Railway **SUCCESS con `commitHash aa28212`**.

--------------------------------------------------------------------

## Estado contra los criterios para levantar el NO-GO

1. Marta y Carlos **rotados** en producción (y en dev). ✔
2. Sesiones anteriores **revocadas** (tabla verificada: 0 sesiones suyas). ✔
3. Credenciales antiguas **no autentican** (`ok: false` verificado en ambos entornos). ✔
4. La rama pública **no añade credenciales vigentes** (todas inertes) y la política de
   `auditorias/` lo **prohíbe** expresamente; el seed ya no puede restaurarlas. ✔
5. Originales verbatim: política de medio privado + copia sanitizada + hash **adoptada**; los
   secretos ya publicados se neutralizaron en origen. No se declara sandbox público. ✔

--------------------------------------------------------------------

## Puntos sugeridos de verificación para el auditor

1. `auth.iniciarSesion` en prod con las claves antiguas → `ok: false` (verificación no intrusiva).
2. Tabla `usuarios` de prod: `op-1783…@demo.mx` ahora **inactivo**; dev: 5 QA inactivos.
3. Tabla `sesiones` de prod: ninguna fila de marta/carlos.
4. `convex/seed.ts` en `aa28212`: sin contraseñas; env var solo al crear.
5. `auditorias/README.md` en `aa28212`: política de sanitización.
6. `tmp/estado-produccion.md`: sin contraseñas en claro; hashes coherentes con Railway y Git.
