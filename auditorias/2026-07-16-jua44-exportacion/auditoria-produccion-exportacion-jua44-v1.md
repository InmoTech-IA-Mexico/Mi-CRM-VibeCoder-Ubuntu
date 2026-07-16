# Acta para dictamen — Exportación de datos en autoservicio (JUA-44) · v1

Fecha: 2026-07-15
Commit candidato: `4108c0d` (sobre prod actual `4b72f65`; app funcional previa `0a66abb`)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Alcance (JUA-44, proyecto "Resto del PRD")

Exportación de datos en autoservicio: Marta (admin) descarga los 4 CSV del negocio (clientes con
papelera, notas, oportunidades, recordatorios) mediante un enlace privado y temporal, sin
intervención del equipo técnico. Carlos (operativo) no ve ni accede a la función.

--------------------------------------------------------------------

## Cambios (10 archivos, +599)

**Backend**
- **`convex/schema.ts`** — tabla `exportaciones` (negocioId, token, expiraEn, usadoEn?,
  solicitadoPorId; índices por_token/por_negocio). Solo guarda el METADATO del enlace; **los CSV no
  se almacenan**.
- **`convex/exportaciones.ts`** (nuevo):
  · `solicitar` (mutation, **solo admin**): invalida enlaces previos sin usar del negocio y crea uno
    nuevo (token de 32 bytes, 24 h). Devuelve el token.
  · `estado` (query, pública por token): valida → `valida | usada | expirada | invalida`.
  · `consumir` (mutation, pública por token, **UN SOLO USO**): marca `usadoEn`, recopila TODOS los
    datos del negocio y devuelve los 4 CSV. Un segundo intento ve "ya se usó".
  · `purgar` (internalMutation): borra enlaces expirados/usados.
  · CSV RFC 4180 (escape de comas/comillas/saltos) + **BOM** (Excel lee bien los acentos); fechas en
    la **zona horaria del negocio** (JUA-28); valores legibles (labels ES).
- **`convex/enumsServidor.ts`** (nuevo) — réplica servidor de `LABELS` (Convex no importa de `src/`;
  misma convención que `convex/fechas.ts`, con nota de sincronizar).
- **`convex/crons.ts`** — cron diario `purga-exportaciones` (09:00 UTC).

**Frontend**
- **`/exportar-datos`** (nuevo, **solo admin**, guard + acceso desde Perfil): botón "Generar
  exportación" → muestra el enlace con **Copiar enlace** y **Abrir descarga** (entrega por pantalla,
  como las invitaciones, mientras no haya email real). Nota de seguridad (24 h · un solo uso · solo
  admin) + opción de regenerar.
- **`/exportar`** (nuevo, **pública, gateada solo por el token** — sin nav, en el grupo (auth)):
  valida con `estado`; al pulsar "Descargar los 4 archivos" consume el enlace (un solo uso) y
  descarga los 4 CSV en el navegador. Auto-descarga + botones de respaldo con check por archivo.

--------------------------------------------------------------------

## Cómo cumple los criterios de aceptación y de seguridad del PRD

- **Solo Marta puede iniciar la exportación** — `solicitar` exige rol admin en servidor; la UI está
  gateada (Perfil admin + guard de ruta); Carlos redirige a `/inicio`.
- **CSV legible con todos los datos** — 4 archivos con cabeceras ES, referencias resueltas (cliente,
  autor, responsable, etiquetas), fechas locales del negocio, BOM. Clientes incluye los de papelera
  (columna "En papelera" + "Eliminado el").
- **Enlace temporal, un solo uso o 24 h** — token único (no predecible), `consumir` es de un solo
  uso y `expiraEn` de 24 h; el cron purga los caducados.
- **URL no pública predecible** — token de 32 bytes hex en el parámetro.
- **No queda almacenado en el servidor** — los CSV se generan al consumir y se devuelven; nunca se
  escriben a File Storage. Solo persiste la fila de metadatos, purgada por cron.

## Decisiones de alcance (para tu revisión)

- **Sin File Storage ni ZIP:** los CSV se generan on-demand en `consumir` y se descargan client-side
  (4 archivos). Cumple "no almacenado en servidor" de forma literal (nada se escribe) y evita
  dependencias nuevas.
- **Entrega por pantalla** ("Copiar enlace" / "Abrir descarga"), no por email — Resend sigue
  bloqueado por el dominio. El enlace funciona en cualquier dispositivo (gateado por token, sin
  sesión), que es el "medio privado y temporal" del PRD.
- **Un enlace vigente por negocio:** solicitar invalida los previos sin usar.

--------------------------------------------------------------------

## Verificación ejecutada (0 errores)

```txt
npx tsc --noEmit       OK      npm run build          OK (rutas /exportar y /exportar-datos)
npx eslint .           OK      npx convex dev --once  OK
```

**Backend por CLI (dev):** operativo `solicitar` → "No autorizado" · admin solicita → token · estado
→ "valida" · consumir → 4 CSV (clientes 17 líneas, notas 8, oportunidades 14, recordatorios 22) ·
reconsumir → "Este enlace ya se usó". CSV con BOM, cabeceras legibles y datos reales verificados.

**Driver Playwright E2E (dev, 390×844, credenciales por variable de entorno): 12/12 PASS + corrida
libre de errores de navegador** — `tmp/drivers-jua44/driver-16-exportar.js`:
- **A (operativo):** no ve "Exportar datos" en Perfil · `/exportar-datos` lo expulsa a `/inicio`.
- **B (admin):** ve el acceso · genera el enlace (token de 64 hex) · la página de descarga carga ·
  **descarga los 4 CSV** (interceptados) · clientes.csv con BOM, cabeceras legibles y "Ana García"
  (dato real) · el enlace es **de un solo uso** (recargar = "Enlace ya utilizado").

**Fix durante la verificación:** la primera corrida reveló que, tras consumir, la query reactiva
`estado` pasaba a "usada" y tapaba los botones de respaldo con el mensaje de enlace usado — si el
navegador bloqueara la auto-descarga, se perdería el respaldo. Corregido: el estado local `archivos`
manda sobre la query, así los 4 botones (con check) permanecen tras descargar. Captura
`tmp/capturas-jua44/d16-descargas.png` (post-fix).

Residuo QA en dev: filas de exportación (se autopurgan; ninguna queda vigente sin usar).

--------------------------------------------------------------------

## Si el dictamen es GO

`npx convex deploy` (funciones nuevas + schema aditivo + cron, ANTES del frontend) → `git push` →
Railway → verificación en vivo (generar/descargar/uso único con la cuenta admin de prod) → JUA-44
Done + comentario → evidencia a `auditorias/` (escaneo de secretos) → `tmp/estado-produccion.md`.
