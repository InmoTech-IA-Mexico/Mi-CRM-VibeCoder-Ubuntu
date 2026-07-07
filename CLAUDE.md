@AGENTS.md

# InmoTech IA México — CRM

App **Next.js 16 (App Router) + React 19 + Tailwind v4 + Convex**. PWA mobile-first (viewport 390×844).

- **Diseño de referencia:** `design/design_handoff_inmotech_crm/*.dc.html` (tokens y specs en su `README.md`). Cada `page.tsx` stub apunta a su `.dc.html` e issue de Linear.
- **Tokens de diseño:** `src/app/globals.css` (`@theme`) — paleta cream/petróleo/dorado, fuentes Lora (serif) + Geist (sans). Usa las utilidades derivadas (`text-ink`, `bg-surface`, `bg-gold-500`, `font-serif`, `rounded-card`…).
- **Rutas:** `src/app/(auth)` (sin nav) y `src/app/(app)` (con bottom nav). Grupos de ruta entre paréntesis.
- **Base de datos:** Convex en `convex/` (`schema.ts`). Catálogos de dominio en `src/lib/enums.ts` — mantener ambos sincronizados.
- **Backlog:** Linear, proyecto "InmoTech IA México — MVP" (issues `JUA-*`); PRD en Notion.

Convenciones: dominio y comentarios en **español**. Next 16 usa APIs asíncronas (`params`/`searchParams` son `Promise`).
