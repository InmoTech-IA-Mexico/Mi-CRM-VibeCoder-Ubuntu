# Auditorías — evidencia durable de entregas a producción

Archivo **versionado** de los ciclos de auditoría del CRM (decisión del 2026-07-15, a raíz de la
precisión DOC-3 del dictamen v3 de JUA-36): antes la evidencia vivía solo en `tmp/` (fuera de git);
desde ahora, al cerrar cada ciclo se copia aquí para que viaje con el repositorio.

## Estructura

Una carpeta por ciclo (`AAAA-MM-DD-<tema>/`) con:

- `auditoria-produccion-*.md` — actas de entrega (qué se construyó, decisiones, verificación).
- `dictamen-*.md` — dictámenes del equipo auditor (GO/NO-GO, observaciones y su seguimiento).
- `drivers/` — drivers Playwright/CLI que produjeron la evidencia + `reporte-*.txt` de las corridas
  (fecha, base URL, resultados). Los drivers son **evidencia de lo que corrió: no se editan**; las
  mejoras van en un driver nuevo versionado.
- `capturas/` — capturas de las corridas (390×844, dev y producción).

## Flujo de trabajo

`tmp/` sigue siendo el área de trabajo del ciclo ACTIVO (acta abierta en el editor, dictámenes
recién recibidos). Al ratificarse el cierre: se archiva en `tmp/archivados/` (histórico local
completo) y la evidencia del ciclo se copia aquí (histórico versionado). Los ciclos anteriores al
2026-07-15 (MVP) permanecen solo en `tmp/archivados/`.

## Política de sanitización (obligatoria — este repositorio es PÚBLICO)

**Prohibido publicar contraseñas, tokens o secretos VIGENTES**, aunque ya aparecieran antes en otra
parte del repositorio (que un secreto esté repetido no lo vuelve seguro — dictamen DOC-3 v1, B-1).

- Los drivers toman credenciales de **variables de entorno** (p. ej. `QA_ADMIN_PASS`), nunca
  literales. Los reportes omiten tokens y contraseñas desde su origen.
- Si un artefacto debe conservarse **verbatim** y contiene secretos: el original se guarda en un
  medio **privado** y aquí se publica solo una copia sanitizada con el hash de integridad del
  original y la lista exacta de campos redactados.
- Antes de copiar evidencia aquí: escanear secretos y **neutralizar en origen** los que aparezcan
  (rotar contraseñas, revocar usuarios QA, invalidar tokens). Las credenciales citadas en los
  ciclos del 2026-07-15 quedaron **inertes**: usuarios QA revocados y contraseñas demo de
  producción y desarrollo **rotadas** (2026-07-15, remediación B-1); el seed ya no re-aplica
  contraseñas a usuarios existentes y la inicial sale de la env var `SEED_DEMO_PASSWORD`.
- Datos personales reales (si algún día los hay en capturas): anonimizar antes de publicar.
