# Acta — Hardening de cuentas (JUA-125) · v2 (remediación del NO-GO v1)

Fecha: 2026-07-15
Commits candidatos: `e22efd9` (base) + `0a66abb` (remedia B-1/B-2 + OBS-1)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Referencia: dictamen v1 = **NO-GO** (B-1 escalada de privilegios, B-2 regeneración incoherente).
Veredicto: **PENDIENTE DE DICTAMEN**

--------------------------------------------------------------------

## B-1 (BLOQUEANTE) — `reactivar` permitía convertir una sesión admin en control persistente

**RESUELTO (`0a66abb`).** `usuarios.reactivar` ahora, **antes de tocar estado, hash, sesiones o
recuperaciones**:
- Rechaza `usuarioId === sesion.usuario._id` → "No puedes reactivar tu propia cuenta".
- Rechaza cualquier objetivo que no sea **inactivo** o **activo SIN `passwordHash`** (enlace de
  reactivación pendiente) → "Solo se puede reactivar a un usuario revocado".

Así, una cuenta activa con contraseña (incluida la del propio admin) no puede ser vaciada y
re-credencializada por quien tenga una sesión admin; el único camino para cambiar la contraseña de
una cuenta activa sigue siendo `auth.cambiarPassword`, que exige la contraseña actual.

**Negativas de servidor ejecutadas (dev, CLI, sesión REAL de Marta), criterios 1 y 3:**
- Reactivar la **propia cuenta admin activa** → "No puedes reactivar tu propia cuenta". **PASS**
- Reactivar a **Carlos (activo con contraseña)** → "Solo se puede reactivar a un usuario
  revocado". **PASS**
- **Sin efectos colaterales:** los prefijos de `passwordHash` de marta y carlos son **idénticos
  antes y después** de las dos negativas; no se creó ninguna recuperación para ellos. (Prueba
  adicional: como `reactivar` borra sesiones *después* del guard, las 3 sesiones vivas de Marta
  —de los logins de prueba— **siguieron intactas** tras las negativas → el rechazo ocurrió antes
  de cualquier mutación. Esas sesiones de prueba se cerraron al terminar.)
- El caso cross-negocio no es ejercitable en dev (un solo negocio); la defensa es el mismo check
  `negocioId !== sesion.negocioId` ya validado estáticamente en el dictamen v1.

--------------------------------------------------------------------

## B-2 — El enlace perdido no tenía ruta real coherente con el copy

**RESUELTO (`0a66abb`).** `usuarios.listar` expone `enlacePendiente` (activo && sin
`passwordHash`). En la lista, un usuario en ese estado muestra el botón **"Nuevo enlace"** junto a
Revocar; regenerarlo emite un token nuevo e **invalida el anterior** (la reactivación purga las
recuperaciones previas). El copy de la hoja ya no menciona "Reactivar" (oculto para activos): apunta
a "Nuevo enlace" en la tarjeta. Cuando el usuario fija su contraseña, `enlacePendiente` pasa a false
y el botón desaparece (queda solo Revocar).

--------------------------------------------------------------------

## OBS-1 — Fallback genérico del seed

**RESUELTO.** `passwordInicialDemo(rol)` ahora exige `SEED_DEMO_PASSWORD_ADMIN` /
`SEED_DEMO_PASSWORD_OPERATIVO` **sin respaldo genérico**; la variable `SEED_DEMO_PASSWORD` se retiró
de dev y prod (`env remove`). Un deployment nuevo debe definir ambas por rol o el seed falla con
mensaje claro.

**OBS-2/3 (evidencia):** el driver v2 (`driver-15-hardening-v2.js`) vigila `pageerror`/
`console.error`, limpia en `finally` (deja el QA inactivo pase lo que pase) y escribe un **reporte
durable con tokens redactados** (`tmp/drivers-jua125/reporte-hardening-v2.txt`).

--------------------------------------------------------------------

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build         OK
npx eslint .       OK      npx convex dev --once OK
```

**Driver v2 (dev, 390×844, admin por env): 14/14 PASS + corrida libre de errores de navegador** —
cubre los criterios 2, 4 y 5 del dictamen:
- Ciclo nominal: inactivo → enlace → nueva contraseña → login (sesión viva) → **uso único** →
  revocación → **la sesión viva muere al instante** (recarga → `/login`).
- **Regeneración (B-2):** cerrar la hoja sin usar el enlace → la tarjeta ofrece "Nuevo enlace" →
  el enlace regenerado es **distinto** → el **anterior queda inválido** ("Enlace no válido") → el
  nuevo abre el formulario. Con contraseña fijada, "Nuevo enlace" desaparece.
- Copy coherente con la ruta real de regeneración.

Capturas en `tmp/capturas-jua125/` (hoja de reactivación · botón "Nuevo enlace" · expulsión de la
sesión revocada). Estado final en dev: Verónica inactiva (con hash aleatorio, no publicado).

Cobertura frente a los 6 criterios del NO-GO: **1** ✔ (negativas) · **2** ✔ (regeneración visible y
coherente) · **3** ✔ (negativas sin efectos) · **4** ✔ (ciclo nominal) · **5** ✔ (token viejo
inválido, nuevo funciona) · **6** ✔ (tsc/eslint/build en 0).

--------------------------------------------------------------------

## Si el dictamen es GO

`npx convex deploy` (funciones primero) → `git push` → Railway → verificación en vivo con un QA de
prod (sin tocar marta/carlos) → JUA-125 Done + comentario → evidencia a `auditorias/` (escaneo de
secretos) → `tmp/estado-produccion.md`.
