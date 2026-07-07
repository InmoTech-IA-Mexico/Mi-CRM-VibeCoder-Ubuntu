# InmoTech IA México — CRM

CRM móvil (PWA) para negocios pequeños: clientes, seguimientos, oportunidades y ventas.
Stack: **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Convex**.

## Requisitos

- Node 20+ (probado con Node 24)
- Cuenta gratuita de [Convex](https://convex.dev) (base de datos)
- Cuenta de [Railway](https://railway.app) para desplegar

## Puesta en marcha

```bash
npm install
npx convex dev      # 1ª vez: inicia sesión y crea el proyecto Convex. Deja esta terminal abierta.
npm run dev         # en otra terminal → http://localhost:3000
```

`npx convex dev` genera `convex/_generated/` y escribe `CONVEX_DEPLOYMENT` y
`NEXT_PUBLIC_CONVEX_URL` en `.env.local`. Sin esas variables la app arranca igual,
pero sin conexión a datos (útil para maquetar pantallas).

## Estructura

```
src/app/
  (auth)/        login · recuperar-password · activar        (sin bottom nav)
  (app)/         inicio · clientes · ventas · seguimientos ·
                 usuarios · papelera · ajustes               (con bottom nav)
  layout.tsx     fuentes (Lora + Geist) + ConvexClientProvider
  globals.css    tokens de diseño (@theme)
src/components/   providers/ · layout/ (bottom-nav) · screen-placeholder
src/lib/          utils (cn) · enums (catálogos de dominio)
convex/           schema.ts (base de datos) + funciones
design/           prototipos de referencia (.dc.html) — no forma parte del build
```

Cada pantalla es por ahora un *stub* que indica su archivo de diseño (`.dc.html`)
y su issue de Linear. Reprodúcelas desde `design/design_handoff_inmotech_crm/`.

## Diseño

Tokens en `src/app/globals.css` (Tailwind `@theme`): paleta cream / petróleo / dorado,
tipografía **Lora** (serif) + **Geist** (sans). Especificación completa en
`design/design_handoff_inmotech_crm/README.md`.

## Base de datos (Convex)

Esquema en `convex/schema.ts` (negocios, usuarios, clientes, notas, oportunidades,
seguimientos, ventas). Ver `convex/README.md`.

## Despliegue en Railway

1. Sube el repo a **GitHub**.
2. En Railway: *New Project → Deploy from GitHub repo* → este repositorio (detecta Next.js vía Nixpacks).
3. Variables de entorno en Railway:
   - `NEXT_PUBLIC_CONVEX_URL` — URL del despliegue de **producción** de Convex.
   - `CONVEX_DEPLOY_KEY` — clave de deploy (Convex dashboard → Settings → Deploy keys).
4. **Build command** — ya viene configurado en `railway.json`:
   ```bash
   npx convex deploy --cmd 'npm run build'
   ```
   Despliega las funciones de Convex a **producción** e inyecta `NEXT_PUBLIC_CONVEX_URL` de prod
   antes de construir Next. **Requiere `CONVEX_DEPLOY_KEY`** (paso 3); sin ella el build falla.
   (Si prefieres desplegar Convex por separado, cámbialo a `npm run build`.)
5. Railway inyecta `PORT`; `next start` lo usa automáticamente. Healthcheck: `/login`.
   Versión de Node fijada en `.nvmrc` (24) y `engines.node` (>=20.9).

## Scripts

| Script | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `start` | Build y arranque de producción |
| `npm run lint` | ESLint |
| `npm run convex:dev` | Convex en modo watch |
| `npm run convex:deploy` | Despliega funciones de Convex |

## Estado

Pantalla **Inicio** (`JUA-27`: agenda del día + panel de inactividad + navegación) implementada
con datos reales de Convex; el resto de pantallas siguen como *stubs* en construcción. Backlog en
Linear → proyecto **"InmoTech IA México — MVP"** (issues `JUA-*`). Autenticación aún pendiente
(hoy hay una sesión simulada; recomendado: Convex Auth email + contraseña, según el PRD — `JUA-6`/`JUA-30`).
