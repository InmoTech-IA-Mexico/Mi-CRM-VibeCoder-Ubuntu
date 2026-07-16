# Acta para dictamen — Conservación durable de evidencia (DOC-3) · v1

Fecha: 2026-07-15
Commit candidato: `cd2a3cd` (sobre `6af3964`, el productivo funcional) — **ya publicado**
Referencia: dictamen v3 de JUA-36 = **ADENDA ACEPTADA**, con una única precisión pendiente:
la evidencia no era durable fuera de este workspace (vivía solo en `tmp/`, ignorado por git).
Alcance: **sin cambios de aplicación** — solo documentación de auditoría + 1 línea de ignore.
Veredicto: **PENDIENTE DE DICTAMEN**

--------------------------------------------------------------------

## Decisión y acción ejecutada

El responsable del proyecto eligió (entre repo versionado / seguir en `tmp/` / Notion) la opción
recomendada por el dictamen: **archivo versionado dentro del repositorio**.

Se creó **`auditorias/`** y se publicó en `cd2a3cd` (45 archivos, +2721):

```
auditorias/
  README.md                        ← estructura, flujo, reglas de sanitización
  2026-07-15-followups-auth/       ← 2 actas · 2 dictámenes · 8 drivers + README · 8 capturas
  2026-07-15-jua37-postventa/      ← 1 acta  · 1 dictamen  · 2 drivers            · 2 capturas
  2026-07-15-jua36-etiquetas/      ← 2 actas · 3 dictámenes · 3 drivers + 2 reportes · 6 capturas
```

Incluye los dos reportes durables señalados por el dictamen (`reporte-etiquetas-v3-prod.txt`,
`reporte-negativas-servidor.txt`), los seis dictámenes del equipo auditor y todas las capturas.

**Flujo establecido (README):** `tmp/` sigue siendo el área de trabajo del ciclo ACTIVO; al
ratificarse un cierre, la evidencia se copia a `auditorias/AAAA-MM-DD-<tema>/`. Los ciclos previos
al 2026-07-15 (era MVP) permanecen solo en `tmp/archivados/` (histórico local).

**Regla adoptada:** los drivers archivados **no se editan** (son evidencia de lo que corrió); toda
mejora va en un driver nuevo versionado.

--------------------------------------------------------------------

## Sanitización — sin alterar la evidencia

Los archivos se copiaron **verbatim** (editarlos rompería su fidelidad). El único material sensible
que contenían eran contraseñas de usuarios QA del negocio demo de producción; en lugar de
redactarlas, se neutralizaron en origen:

- **`qa-bienvenida-op@demo.mx` y `qa-bienvenida-admin@demo.mx` quedaron REVOCADOS en producción**
  (estado inactivo → no pueden iniciar sesión; verificable en la Gestión de usuarios del demo).
- Las demás credenciales citadas (marta/carlos demo) ya estaban versionadas en `convex/seed.ts`.
- Los reportes se generaron sin tokens ni contraseñas desde su origen.

--------------------------------------------------------------------

## Integridad del delta `6af3964..cd2a3cd`

- 45 archivos: 44 bajo `auditorias/` (markdown, js de QA, txt, png) + `eslint.config.mjs`.
- El único cambio fuera de `auditorias/` es **una línea**: `"auditorias/**"` en los ignores de
  eslint (los drivers archivados usan `require()` y no son código de la app).
- **Cero cambios en `src/`, `convex/` o configuración de runtime.**
- `npx tsc --noEmit` y `npx eslint .` en 0 tras el cambio.
- `git push` hecho; Railway reconstruyó y quedó en **SUCCESS con `commitHash cd2a3cd`** (misma app
  que `6af3964`; Convex prod no se tocó — sin re-deploy de funciones).

--------------------------------------------------------------------

## Sugerencias menores del dictamen v3 — registradas para futuros drivers

Anotadas en la memoria del proyecto (no aplicadas al driver v3 archivado, por la regla de no
alterar evidencia):

1. Escribir el reporte también ante excepción (catch + reporte tras el finally + exit code).
2. Usar la frase exacta "sin pageerror ni console.error inesperados" (los 65 `requestfailed` de la
   corrida fueron abortos `net::ERR_ABORTED` de RSC/prefetch de Next, informativos).
3. Clasificar/excluir abortos de navegación si `requestfailed` se quiere como señal accionable.

--------------------------------------------------------------------

## Puntos sugeridos de verificación para el auditor

1. Estructura y contenido de `auditorias/` en `origin/main` (`cd2a3cd`) — que la evidencia viaje
   con un clon nuevo.
2. Delta limpio: nada de app en `6af3964..cd2a3cd` salvo la línea de eslint.
3. Los dos usuarios QA de prod en estado **Inactivo** (tabla `usuarios` o pantalla `/usuarios`).
4. Coherencia de `tmp/estado-produccion.md` (encabezado en `cd2a3cd`, nota de convención nueva).
5. Que los reportes versionados no contengan tokens ni contraseñas vigentes.
