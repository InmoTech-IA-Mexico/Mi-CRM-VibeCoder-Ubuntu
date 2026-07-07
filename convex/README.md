# Convex — backend de InmoTech IA México

Esta carpeta contiene el backend/base de datos en **Convex**.

- `schema.ts` — esquema de tablas (negocios, usuarios, clientes, notas, oportunidades, seguimientos, ventas…).
- `_generated/` — código y tipos generados por Convex (se crea al ejecutar `convex dev`; no editar a mano).

## Primer arranque (enlazar un despliegue)

```bash
npx convex dev
```

La primera vez te pedirá iniciar sesión y crear/elegir un proyecto de Convex. Al terminar:

- Genera `convex/_generated/` (API y tipos).
- Escribe `CONVEX_DEPLOYMENT` y `NEXT_PUBLIC_CONVEX_URL` en `.env.local`.
- Queda en modo *watch*: cada cambio en esta carpeta se sube al instante.

Deja `npx convex dev` corriendo en una terminal y `npm run dev` en otra.

## Producción (Railway)

El despliegue de producción se hace con `npx convex deploy` (ver README raíz). En Railway,
el *build command* recomendado es:

```bash
npx convex deploy --cmd 'npm run build'
```

que sube las funciones de Convex, inyecta `NEXT_PUBLIC_CONVEX_URL` de producción y construye Next.js.
Requiere la variable `CONVEX_DEPLOY_KEY` en Railway.
