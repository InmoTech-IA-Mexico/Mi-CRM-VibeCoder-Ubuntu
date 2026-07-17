# Acta de auditoría — Visibilidad de agregados por cartera (JUA-126) · v1

Fecha: 2026-07-16  
Commit auditado: `2e92576`  
Base anterior: `7dfa2aa`  
Estado revisado: candidato local; no desplegado por esta auditoría  
Veredicto: **NO-GO — regresión visible por contrato nullable sin adaptar un consumidor operativo**

---

## Resultado

No procede desplegar `2e92576` todavía.

La política de privacidad está correctamente aplicada en el servidor: el operativo deja de recibir cargas del equipo y los conteos de etiqueta se limitan a su cartera. Sin embargo, el cambio de `usuarios.equipo.usuarios[].clientes` de número a `null` para no-admin no adaptó todos los consumidores. El flujo operativo de crear un seguimiento personal muestra literalmente `Operativo · null clientes`.

La corrección necesaria es pequeña y no cuestiona la política ni el esquema, pero el candidato afirma que no hay cambios de UI y actualmente degrada una ruta existente del operativo.

## Integridad y comprobaciones locales

- `2e92576` es hijo directo de `7dfa2aa`; `origin/main` permanecía en `7dfa2aa` durante la auditoría.
- Delta: solo `convex/etiquetas.ts` y `convex/usuarios.ts`, `+12 −4`; `git diff --check 7dfa2aa..2e92576` sin errores.
- `npx tsc --noEmit`, `npx eslint .` y `npm run build` finalizaron correctamente. El primer build local no pudo descargar las fuentes de Google por la restricción de red; el reintento autorizado generó las 25 rutas sin errores.
- No se ejecutaron drivers, mutaciones de Convex, despliegues ni cambios externos desde esta auditoría.

## Hallazgo bloqueante

### B-1 — `clientes: null` se renderiza como texto en el flujo operativo de tareas personales

**Estado: ABIERTO.**

`usuarios.equipo` ahora devuelve `clientes: null` a todo rol no administrador. Esto satisface que el operativo no reciba la carga de cada miembro.

No obstante, `/seguimientos/nuevo` consulta `api.usuarios.equipo` para todos los roles. Un operativo puede crear una tarea para sí mismo; al elegir destino `empleado`, el formulario muestra su tarjeta con `subtituloMiembro`. Esa función devuelve:

```ts
`${LABELS.rol[m.rol]} · ${m.clientes} ${m.clientes === 1 ? "cliente" : "clientes"}`
```

Como `m.clientes` es `null`, el resultado visible es `Operativo · null clientes`. La tarjeta usa ese subtítulo aun cuando el selector de empleado queda bloqueado para el operativo; la tarea personal sigue siendo una ruta funcional permitida.

TypeScript y el build no lo detectan porque interpolar `null` en una plantilla es válido en JavaScript.

**Corrección requerida:** adaptar `subtituloMiembro` —y cualquier consumidor equivalente— para omitir el conteo cuando `clientes == null`, por ejemplo mostrando solo el rol para no-admin. Debe conservarse la cifra numérica para los selectores administrativos.

**Verificación requerida:** iniciar sesión como operativo, abrir `/seguimientos/nuevo`, elegir destino `Empleado` y confirmar que la tarjeta personal no muestra `null`; confirmar que el admin aún ve las cargas en sus selectores.

## Aspectos correctamente implementados

- `etiquetas.listar` aplica `esDeCartera` antes de acumular cada etiqueta. Admin y observador conservan los conteos globales; el operativo recibe un conteo coherente con la lista y filtro que ya puede ver.
- `usuarios.equipo` conserva nombres, roles, `miId` y `esYo`, pero devuelve carga numérica solo al admin. El operativo no recibe la métrica de otros miembros por la red.
- El selector de responsable del cliente consulta `equipo` únicamente cuando el rol es admin, por lo que su presentación administrativa conserva conteos válidos.
- No se modifican esquema, autenticación, roles ni nuevas funciones públicas.

## Evidencia revisada

El driver `tmp/drivers-jua126/driver-27-agregados-servidor.js` pasa la comprobación sintáctica de Node. El reporte sanitizado declara **4 PASS / 0 FAIL** y cubre correctamente el contrato de servidor:

- Operativo: miembros sin carga (`clientes === null`).
- Admin: carga numérica.
- Conteo de etiqueta para operativo igual a su cartera y para admin igual al negocio.

La prueba no abre `/seguimientos/nuevo` como operativo; por ello no cubre B-1. El defecto deriva directamente de la combinación del nuevo valor `null` y el interpolado existente en `subtituloMiembro`.

## Observaciones no bloqueantes

### OBS-1 — Limpieza del driver ante fallos tempranos

Los logins y parte de la preparación ocurren antes del bloque `try/finally`. Si fallaran, las sesiones o algún fixture pueden no limpiarse. Conviene envolver toda la preparación y conservar el resultado de la limpieza en el reporte.

### OBS-2 — Cobertura de observador

La política devuelve `clientes: null` también al observador, porque el código restringe la carga a admin. Es coherente con el comentario de “información de gestión solo admin”, pero el driver no lo afirma. Añadir una aserción explícita evitaría ambigüedad futura.

## Criterios para levantar el NO-GO

1. Corregir el renderizado de `clientes: null` en `/seguimientos/nuevo` y buscar otros consumidores de `usuarios.equipo` que interpolen o calculen con esa propiedad.
2. Ejecutar una prueba UI con operativo en tarea personal y una con admin en selector de equipo.
3. Repetir el driver de servidor, `tsc`, `eslint`, build y Convex dev.
4. Preservar un reporte sanitizado de las pruebas y limpiar los datos QA.

## Constancia de auditoría

La revisión fue de solo lectura sobre Git, código, driver, reporte y comprobaciones locales. No se modificó código de aplicación, configuración, datos de desarrollo o producción, despliegues, repositorio remoto ni Linear.
