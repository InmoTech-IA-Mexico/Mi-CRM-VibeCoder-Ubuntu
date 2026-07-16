# Acta de dictamen — Follow-ups de cierre de auth · v2

Fecha: 2026-07-15  
Commits candidatos: `fc02288` + `338e28c`  
Base productiva actual: `2cc9d44`  
Estado: construido y verificado en local + desarrollo de Convex. **No desplegado.**  
Referencia: dictamen v1 = **GO CON OBSERVACIONES NO BLOQUEANTES** sobre `fc02288`.  
Veredicto v2: **GO**

---

## Resultado del dictamen

Se concede **luz verde explícita para que el responsable autorizado ejecute el despliegue** de `fc02288 + 338e28c`.

No se encontraron hallazgos funcionales, de seguridad o de compatibilidad que bloqueen el paso a producción.

`338e28c` es hijo directo de `fc02288`, modifica únicamente `src/app/(auth)/activar/_components/pantalla-activar.tsx` y el árbol se encontraba limpio durante la auditoría.

## Revisión de las observaciones del dictamen v1

### OBS-1 — Persistencia de la bienvenida

**Estado: RESUELTA.**

La bienvenida se conserva en `sessionStorage` mediante una clave asociada al token de invitación. La lectura utiliza `useSyncExternalStore` con:

- Snapshot de servidor estable en `null`.
- Snapshot cliente basado en la cadena almacenada.
- Acceso a `sessionStorage` protegido ante excepciones.
- Estado local para mostrar inmediatamente la bienvenida después de activar.
- Eliminación de la clave al pulsar **Empezar**.

La solución es coherente con React 19 y con el modelo de componentes cliente de Next.js 16.2.10. Evita el desajuste de hidratación y permite que una recarga conserve la pantalla final.

Como degradación controlada, si `sessionStorage` no está disponible, la activación continúa y únicamente se pierde la persistencia entre recargas.

### OBS-2 — Accesibilidad

**Estado: RESUELTA.**

- El nombre utiliza `gold-text` (`#A87E33`) sobre crema (`#FBF8F1`), con contraste aproximado de **3.48:1**. Cumple WCAG AA para el texto grande de 28 px semibold.
- El halo incluye `motion-reduce:animate-none`, respetando `prefers-reduced-motion`.
- El encabezado de bienvenida tiene `tabIndex={-1}` y recibe foco programático al montar, permitiendo que lectores de pantalla anuncien el resultado del cambio dinámico.

### OBS-3 — Conservación de evidencia automatizada

**Estado: RESUELTA EN SU OBJETIVO DE PRESERVACIÓN, con precisión documental.**

Se localizaron en `tmp/drivers-followups-auth/`:

- `README.md` con requisitos, preparación, uso y resultados.
- `driver-1-invitar.js`.
- `driver-2-activar.js`.
- `driver-3-recuperacion.js`.
- `driver-4-toggle-veronica.js`.
- `driver-5-invitar-nuevos.js`.
- `driver-6-activar-reload.js`.

Los seis scripts pasaron la comprobación sintáctica de Node. La captura adicional `d6-bienvenida-op-reload.png` es un PNG de 390×844 y acredita visualmente la bienvenida operativa después de recargar.

#### Precisión necesaria sobre los resultados

No debe presentarse **18 PASS** como si todos correspondieran a la implementación definitiva:

- **6 PASS / 0 FAIL** corresponden al código definitivo con `useSyncExternalStore`, ejercitado con la variante operativa.
- **12 PASS / 0 FAIL** son evidencia histórica de la primera implementación con `useEffect`, posteriormente descartada por lint.

La variante admin no fue repetida sobre la implementación definitiva. Esto no bloquea el dictamen porque la persistencia es común a ambos roles y la diferencia entre variantes se limita a los datos y presentación de la bienvenida.

**Acción sugerida:** incluir la activación admin, recarga y navegación a `/inicio` en el smoke test productivo.

Los drivers están dentro de `tmp/`, directorio excluido de Git. Para que la evidencia sea durable deberán conservarse en el archivo formal de auditoría o en otro almacenamiento persistente.

### OBS-4 — Riesgo futuro multinegocio

**Estado: REGISTRADA Y ACEPTADA, sin cambio requerido para esta liberación.**

Antes de habilitar aprovisionamiento multinegocio deberá impedirse la duplicación global de invitaciones pendientes o revalidarse el email al ejecutar `reenviar`.

## Integridad y alcance

- `338e28c` tiene como padre directo a `fc02288`.
- El delta `fc02288..338e28c` contiene un solo archivo.
- `git diff --check fc02288..338e28c` no reporta errores.
- No hubo cambios en Convex dentro de `338e28c`; la evidencia de recuperación y unicidad global continúa siendo la del dictamen v1.
- La navegación mediante `router.replace("/inicio")` coincide con la API instalada de Next.js 16.2.10.

## Dictamen de liberación

**GO para desplegar `fc02288 + 338e28c`.**

Secuencia prevista para el responsable autorizado:

1. Desplegar las funciones de Convex en producción.
2. Publicar los commits y permitir la construcción de Railway.
3. Ejecutar la verificación en vivo.
4. Registrar el resultado en Linear, archivar las actas y actualizar el estado de producción.

## Verificación mínima en vivo

1. Una cuenta inactiva no puede consultar ni consumir un enlace de recuperación previamente emitido.
2. Invitar un email ya registrado presenta “Ya existe una cuenta con ese email”.
3. Una activación operativa muestra la bienvenida, sobrevive una recarga y **Empezar** conduce a `/inicio`.
4. Una activación admin muestra la bienvenida, sobrevive una recarga, conserva el negocio y **Empezar** conduce a `/inicio`.
5. Después de pulsar **Empezar**, revisitar el enlace muestra “Cuenta ya activada”.
6. Convex y Railway corresponden al candidato final `338e28c`.

JUA-7 y JUA-8/9 deben permanecer abiertas hasta completar el envío real de correo mediante Resend.

## Constancia de auditoría

Durante el dictamen no se modificó código, no se desplegaron funciones, no se hizo `git push`, no se ejecutaron pruebas que alteraran datos y no se modificaron los entornos de desarrollo o producción.
