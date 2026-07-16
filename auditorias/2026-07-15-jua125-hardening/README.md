# JUA-125 — Hardening de cuentas y seeds (2026-07-15)

Ciclo: OBS-1/OBS-2 del dictamen de remediación B-1 → v1 **NO-GO** (B-1 escalada de privilegios en
`reactivar`; B-2 regeneración de enlace incoherente) → v2 **GO con obs. documentales**.

En producción desde **`0a66abb`** (Convex `glad-bird-297` + Railway SUCCESS). Verificado en vivo.

## Contenido

- `auditoria-produccion-hardening-jua125-v1.md` / `-v2.md` — actas de entrega.
- `drivers/driver-15-hardening-v2.js` — E2E del ciclo nominal + regeneración (B-2); credenciales
  admin por variable de entorno `ADMIN_PASS`.
- `drivers/reporte-hardening-v2-prod.txt` — corrida contra producción (15/15 PASS, sin errores de
  navegador, cleanup verificado). Tokens no persistidos.
- `drivers/reporte-negativas-servidor-prod.txt` — criterios 1/3: reactivar la propia admin y otra
  cuenta activa con contraseña → rechazados; `hash_unchanged=true`, `recoveries_unchanged=true`
  (sin revelar hashes ni tokens).
- `capturas/d15-nuevo-enlace.png` — evidencia v2 del botón **Nuevo enlace** (la ruta real de B-2).

## Nota sobre capturas

`d14-*` (en `tmp/`, no versionadas) son del flujo **v1** con el copy anterior ("vuelve a pulsar
Reactivar") — histórico, NO reflejan el copy final. La captura vigente del flujo corregido es
`d15-nuevo-enlace.png`.
