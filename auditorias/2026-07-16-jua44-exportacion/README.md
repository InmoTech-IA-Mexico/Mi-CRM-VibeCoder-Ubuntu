# JUA-44 — Exportación de datos en autoservicio (2026-07-16)

Ciclo: v1 **NO-GO** (B-1 CSV/formula injection; B-2 campos persistidos omitidos) → v2 **GO con obs.
de evidencia**. En producción desde **`757abc0`** (Convex `glad-bird-297` + Railway SUCCESS).
Verificado en vivo.

## Qué hace

Solo admin. "Exportar datos" en Perfil → enlace privado y temporal (token único, 24 h, un solo uso)
→ página pública `/exportar` descarga los 4 CSV (clientes con papelera, notas, oportunidades,
recordatorios). Los CSV se generan al consumir y **no se almacenan** en el servidor; un cron purga
los enlaces caducados.

## Seguridad de los CSV (B-1)

`convex/csv.ts` neutraliza CSV/formula injection: los campos de TEXTO con iniciador de fórmula
(`= + - @`, variantes de ancho completo, tab/CR/LF) se prefijan con apóstrofo antes del escape
RFC 4180; los números reales (monto) no se tocan. Compromiso de compatibilidad documentado (el
apóstrofo puede quedar visible según el lector; neutraliza la fórmula, no altera el dato de origen).

Corroborado con importación a LibreOffice (headless, XLSX): CSV neutralizado = **0 fórmulas**;
control sin neutralizar = fórmula presente.

## Contenido

- `auditoria-produccion-exportacion-jua44-v1.md` / `-v2.md` — actas.
- `drivers/driver-16-exportar.js` — UI E2E (admin/operativo, enlace, descarga 4/4, un solo uso).
  Credenciales por env; CSV descargados a dir temporal borrado en la salida del proceso.
- `drivers/driver-17-export-fixtures.js` — fixtures de fórmula (B-1) + completitud por columna (B-2),
  con cleanup reportado; credenciales/CWD por env.
- `drivers/driver-18-csv-unit.mjs` — test unitario de `convex/csv.ts` (tabla completa de iniciadores,
  incluidos tab/CR/LF y ancho completo). `REPO_DIR=<repo> node --experimental-strip-types …`.
- `drivers/reporte-*-prod.txt` — corridas contra producción (UI 12/12, fixtures 14/14) + unit 23/23.
- `capturas/` — enlace listo y página de descarga con los 4 archivos.

Sin `dl-*.csv` ni tokens/credenciales vigentes (escaneado).
