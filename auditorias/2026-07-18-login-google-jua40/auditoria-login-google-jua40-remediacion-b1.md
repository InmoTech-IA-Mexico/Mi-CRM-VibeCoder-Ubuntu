# Acta de remediación — Login con Google (JUA-40) · B-1 (nonce/DoS)

Fecha: 2026-07-17
Commits: `9f492c1` (remediación B-1) + `8082b99` (OBS-2), sobre `39854f1` (base productiva `809fc94`).
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Referencia: dictamen implementación v1 = **NO-GO** por B-1 (disponibilidad/abuso de nonce).
**Resultado: dictamen v2 = GO con observaciones no bloqueantes** (despliegue **no autorizado aún**: falta el
Client ID + verificación en vivo).

--------------------------------------------------------------------

## B-1 — Emisión anónima de nonces con cuota global = DoS → REMEDIADO

**El defecto (confirmado):** `emitirNonceLogin` era una mutación **pública anónima** con una **cuota global**
(~500 nonces vivos). Un atacante podía llenarla (peticiones directas o cargas automatizadas de `/login`) y
**bloquear a todos** los registros de nonce durante su TTL. El botón pedía un nonce **al montar**,
amplificándolo. `emitirNonceVincular` no acotaba por usuario y la purga tenía un lote fijo.

**La remediación (`9f492c1`) — opción 3 del dictamen: registrar el consumo, no la emisión.**

Se **elimina toda emisión de nonces del servidor**. El nonce lo genera el **cliente** (aleatorio,
`crypto.getRandomValues`), viaja en el ID token, y el backend lo **registra como CONSUMIDO** solo **tras
verificar una credencial de Google válida**:

- Tabla `noncesLogin` (emitidos) → **`noncesConsumidos`** (`nonce`, `expiraEn`). Índices `por_nonce`, `por_expira`.
- **No existe** una mutación pública de emisión (verificado: `emitirNonceLogin`/`emitirNonceVincular` retiradas).
- `consumirNonceLoginGoogle` / `consumirNonceVincular` (internas, las llama la action tras verificar el token):
  **registran el nonce** (si ya está → `ok:false`, replay) **+ resuelven/vinculan por `sub`**, en una sola
  mutación (atómico). `expiraEn` = `exp` del token → se purga cuando el token ya no es válido.
- **Sin ruta anónima que llenar:** `noncesConsumidos` solo crece con **autenticaciones reales de Google**
  (limitadas por Google, requieren un ID token válido). La disponibilidad de otros usuarios no depende de una
  cuota compartida.
- **Cross-operación** cubierto por la propia tabla: un nonce consumido por login no sirve para vincular (y
  viceversa).

## Observaciones no bloqueantes — atendidas

- **Cuota off-by-one (`> NONCE_VIVOS_MAX`):** eliminada (ya no hay cuota de emisión).
- **Frontend sin separador huérfano:** al generarse el nonce en el cliente (sin llamada de emisión), no hay
  error de emisión ni cuota; el botón aparece siempre (tras un instante) si hay Client ID.
- **Bloqueo por contraseña y Google:** el botón de Google en `/login` **ya no se atenúa** por el bloqueo de
  intentos de contraseña (es otra credencial, no una adivinación de contraseña).

## Verificación (dev, driver-44, 9/9) — verificador simulado

Reporte `tmp/drivers-jua40/reporte-google-auth-dev.txt`. Sin tokens/sub/email reales; vínculos limpiados.

- Vínculo fija `googleSub`; **sub ya de otro** → rechazado.
- Login por `googleSub` → sesión correcta; **sin vínculo** → rechazado; **inactivo** → rechazado.
- **Replay** del mismo nonce → rechazado; **cross-operación** (nonce de login no sirve para vincular) → rechazado.
- **Purga** elimina consumidos expirados.
- **T9:** no existe `emitirNonceLogin` público (la ruta anónima ya no está).

```txt
npx tsc --noEmit  OK    npx eslint  OK    npm run build  OK    convex dev --once  OK (noncesConsumidos)
```

## Observaciones del dictamen v2 — estado

- **OBS-2 (cotas de entrada) — APLICADA (`8082b99`):** la action rechaza `idToken` > 8192 o `nonce` > 128 /
  vacío antes de llamar a la librería (acota coste/memoria ante tráfico arbitrario).
- **OBS-1 / OBS-3 / OBS-4 — diferidas a la verificación en vivo:** prueba real con Client ID y cuenta QA
  (vínculo, login, credencial inválida, replay); observar el tamaño de `noncesConsumidos` a escala; prueba de
  UI en navegador (nonce nuevo tras reintento; estado de vínculo reactivo/accesible). Sin guardar tokens/sub/
  email/Client ID en la evidencia.

## Pendiente (condiciones del dictamen para el despliegue)

1. **Client ID** de Google (operador) → `GOOGLE_CLIENT_ID` (Convex dev+prod) + `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   (Railway). Sin valores sensibles en Git/actas.
2. **Convex primero** + verificar contrato en prod → `git push`.
3. **Verificación en vivo** con cuenta QA revocable: vincular desde Perfil → cerrar sesión → entrar por Google
   (sesión 8 h) → credencial inválida + replay.
4. Revocar/desvincular QA + limpiar + archivar evidencia sanitizada → cerrar JUA-40.

## Constancia

Cambios en `convex/{schema,google,googleAction}.ts` + frontend. No desplegado, sin `git push`, sin tocar
prod/remoto. (Tabla `noncesLogin` residual en dev es huérfana inocua; prod nunca la tuvo.)
