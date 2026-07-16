# Drivers Playwright — follow-ups de auth (fc02288 + obs. del dictamen v1)

Evidencia reproducible del acta `tmp/auditoria-produccion-followups-auth-v1.md` (y v2).
Archivados por la OBS-3 del dictamen v1.

## Requisitos

- Dev server corriendo: `npm run dev` (app en `http://localhost:3000`, apuntando al
  deployment DEV de Convex `merry-squirrel-978` vía `.env.local`).
- Funciones al día en dev: `npx convex dev --once`.
- Playwright: `npm i playwright@1.61.1` en un directorio aparte (no del proyecto) y
  `npx playwright install chromium`.
- Credenciales seed: `marta@demo.mx / Marta1234` (admin), `carlos@demo.mx / Carlos1234`.

## Drivers y uso

| Driver | Qué verifica | Uso |
|---|---|---|
| `driver-1-invitar.js` | Invitar operativo/admin; unicidad global ("Ya existe una cuenta con ese email"); invitación pendiente duplicada | `SHOTS_DIR=. node driver-1-invitar.js` |
| `driver-2-activar.js` | Activación + bienvenida (operativo y admin) → Empezar → /inicio | `node driver-2-activar.js <tokenOp> <tokenAdmin>` |
| `driver-3-recuperacion.js` | Recuperación endurecida: revocar → enlace inválido → reactivar → restablecer → login | `node driver-3-recuperacion.js <tokenRecuperacion>` |
| `driver-4-toggle-veronica.js` | Revocar/Reactivar a Verónica (apoyo del check de servidor) | `node driver-4-toggle-veronica.js Revocar\|Reactivar` |
| `driver-5-invitar-nuevos.js` | Crea una invitación parametrizada | `node driver-5-invitar-nuevos.js <email> <nombre> [Administrador]` |
| `driver-6-activar-reload.js` | OBS-1/OBS-2: bienvenida sobrevive recarga; Empezar limpia la persistencia | `NOMBRE_OP="..." node driver-6-activar-reload.js <tokenOp> [<tokenAdmin>]` |

Los tokens de invitación/recuperación se leen de las tablas `invitaciones` /
`recuperaciones` del deployment DEV (dashboard o `npx convex data <tabla>`).

El check de servidor del acta (restablecer con usuaria revocada) es:
`npx convex run recuperacion:restablecer '{"token":"<token>","password":"..."}'`
→ debe rechazar con "Enlace no válido".

## Resultados de las corridas (2026-07-15, dev)

- Driver 1: **5 PASS / 0 FAIL**
- Driver 2: **9 PASS / 0 FAIL** (sobre `fc02288`)
- Driver 3: **7 PASS / 0 FAIL**
- Check servidor restablecer revocada: **rechazado con "Enlace no válido"** ✔
- Driver 6 (obs., 1.ª corrida con fix por useEffect): **12 PASS / 0 FAIL**
- Driver 6 (obs., corrida final con useSyncExternalStore): **6 PASS / 0 FAIL** (operativo)

Capturas en `tmp/capturas-followups-auth/`.
