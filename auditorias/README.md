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

## Nota de sanitización

Los reportes omiten tokens y contraseñas. Las credenciales que aparecen en drivers y actas son las
del **negocio demo** (ya presentes en `convex/seed.ts`) o de **usuarios QA desechables** del demo;
los usuarios QA de producción quedaron **revocados** al cerrar su ciclo (no pueden iniciar sesión).
