---
name: project-vibecodercrm
description: "InmoTech IA México — CRM móvil (PWA) para negocios pequeños: gestión de clientes, seguimientos, oportunidades y ventas"
metadata: 
  node_type: memory
  type: project
  originSessionId: 294a467d-f0fd-4368-a861-3f893181ce2b
---

Proyecto CRM cuyo **nombre de producto oficial es "InmoTech IA México"** (unificado el 2026-07-06; nombres anteriores usados durante el desarrollo: "VibeCoder CRM" / "Vibe CRM").

**Why:** El usuario quiere construir un CRM con estilo moderno 2026 (dark glassmorphism, gradientes neón, Inter font) en un solo archivo HTML.

**How to apply:** Mantener todo en un único `index.html` en `/home/hp/Mis Proyectos/VibeCoderNext/MiCRMBasic/`. No crear archivos separados de CSS/JS a menos que el usuario lo pida explícitamente.

Módulos implementados:
- Dashboard con KPIs, gráficos (Chart.js), actividad reciente y pipeline resumen
- Gestión de Clientes con tabla, filtros y estados
- Pipeline de Ventas (Kanban 5 columnas)
- E-Commerce: Productos Digitales (cursos, membresías, plantillas, e-books)
- Pedidos & Pagos (tabla de transacciones)
- Redes Sociales: Instagram, TikTok, LinkedIn, Facebook, YouTube, WhatsApp — captación de leads
- Email Marketing: campañas, segmentos
- Automatizaciones: workflows con IA (Claude)
- Analytics & IA: predicciones, funnel, LTV

Stack: HTML + CSS custom (CSS variables, glassmorphism) + Chart.js CDN + Google Fonts (Inter).
Conectado a GitHub CLI según el usuario.

---

## Plan de desarrollo en Linear (desde 2026-06-18)

El PRD fue aprobado con GO el 2026-06-18. El plan de trabajo completo del MVP fue creado en Linear:
- **Proyecto Linear:** "CRM MVP" — https://linear.app/juan-manuel-dominguez/project/crm-mvp-c86be4b5c793
- **Team:** Juan Manuel Dominguez (JUA)
- **Issues:** JUA-5 a JUA-32 (28 tareas)
- **Linear es la fuente de verdad** del desarrollo — ya no se consulta Notion para ejecutar tareas.

### Fases (milestones) y tareas — CRM MVP
- **Fase 1** (JUA-5 a JUA-11): Infraestructura base y autenticación (7 tareas)
- **Fase 2** (JUA-12 a JUA-16): Gestión de clientes (5 tareas)
- **Fase 3** (JUA-17 a JUA-19): Notas e historial (3 tareas)
- **Fase 4** (JUA-20 a JUA-21): Oportunidades y pipeline (2 tareas)
- **Fase 5** (JUA-22 a JUA-24): Recordatorios y agenda (3 tareas)
- **Fase 6** (JUA-25 a JUA-28): Panel de inactividad y reglas de negocio (4 tareas)
- **Fase 7** (JUA-29 a JUA-30): Administración y permisos (2 tareas)
- **Fase 8** (JUA-31 a JUA-32): Estados de interfaz y cierre (2 tareas)

---

## Proyecto "CRM — Resto del PRD" (desde 2026-06-19)

Todo lo del PRD que quedó fuera del MVP. Issues JUA-33 a JUA-44 (12 tareas).
- **Proyecto Linear:** https://linear.app/juan-manuel-dominguez/project/crm-resto-del-prd-0dd0635f73c1

### Fases — CRM Resto del PRD
- **Fase 1** (JUA-33): Notificaciones push — alerta de cliente frío
- **Fase 2** (JUA-34 a JUA-35): Dashboard y reportes (resumen del mes, estado global)
- **Fase 3** (JUA-36 a JUA-38): Funciones avanzadas (etiqueta producto, post-venta automático, fuente de contacto)
- **Fase 4** (JUA-39 a JUA-41): Onboarding y acceso (registro público, OAuth, automatizar cuenta)
- **Fase 5** (JUA-42 a JUA-43): Escalabilidad de roles (solo lectura, cartera por vendedor)
- **Fase 6** (JUA-44): Exportación de datos en autoservicio

**El PRD está 100% cubierto entre los dos proyectos. No hay nada pendiente de asignar.**

---

## Mejora #1 — Prioridad de clientes (JUA-45 a JUA-49)

Milestone "Mejora #1 — Prioridad de clientes" en CRM MVP. 5 tareas (JUA-45 a JUA-49). Prioridad Alta/Media/Baja en clientes, con orden en panel de inactividad: Alta primero.

---

## Fase 0 — Diseño (JUA-50 a JUA-64)

Milestone creado en CRM MVP. 15 tareas con prompts listos para Claude Design / Google Stitch.

**Estilo:** Dark glassmorphism, bg #0a0a0f, glass rgba(255,255,255,0.05)+blur(20px), gradiente #7c3aed→#3b82f6, cyan #06b6d4, Inter, glow shadows. PWA mobile-first, viewport 390×844px.

### Design System (4 tareas)
- JUA-50: Tokens de diseño (colores, tipografía, espaciado, sombras)
- JUA-51: Componentes base (botones, inputs, selects, badges, chips)
- JUA-52: Componentes compuestos (cards, listas, modales, toasts, bottom sheets)
- JUA-53: Navegación global, layout y estados vacíos/carga/error

### Pantallas de autenticación (3 tareas)
- JUA-54: Login (4 estados: vacío, error, cargando, bloqueado)
- JUA-55: Recuperar contraseña + Nueva contraseña (3 pasos)
- JUA-56: Activación de cuenta (flujo Admin 3 pasos + Operativo 2 pasos + enlace expirado)

### Pantallas principales (2 tareas)
- JUA-57: Inicio — Agenda del día + Panel de inactividad
- JUA-58: Lista de clientes (búsqueda + badge prioridad + filtros)

### Pantallas de detalle y formularios (5 tareas)
- JUA-59: Ficha de cliente (perfil + historial + oportunidades)
- JUA-60: Nuevo cliente (alta rápida)
- JUA-61: Nueva nota + Nuevo recordatorio
- JUA-62: Nueva oportunidad / Editar oportunidad

### Pantallas exclusivas de Administrador (2 tareas)
- JUA-63: Gestión de usuarios (invitar, revocar, reactivar)
- JUA-64: Papelera de clientes (restaurar, eliminar definitivamente)

---

## Revisión de diseño e incorporación al MVP (2026-07-06)

Tras diseñar las 14 pantallas del handoff "InmoTech IA" (`design/design_handoff_inmotech_crm/`), se revisó cada pantalla en detalle contra el PRD y el backlog de Linear. Resultado: el PRD en Notion se amplió con el anexo *"Alineación PRD ↔ Diseño"* y se crearon 16 tareas de desarrollo nuevas (JUA-109 a JUA-124) en el proyecto **CRM MVP**, más comentarios de referencia de diseño en 36 issues.

**Decisión de alcance:** el módulo de Ventas y los seguimientos avanzados **entran en el MVP** (no se difieren a "Resto del PRD").

**Referencia de diseño en issues:** cada tarea con pantalla (16 nuevas + 20 de desarrollo existentes) tiene un comentario "📐 Referencia de diseño" que apunta al archivo `.dc.html` y la variante `data-screen-label` exacta, para implementar 100% fiel al diseño.

### Mejora #2 — Ventas y registro de ingresos (JUA-109 a JUA-114)
Módulo de Ventas incorporado al MVP. Registrar una venta se añade al historial del cliente y NO cambia su estado.
- JUA-109: Modelo de datos "Venta" (nueva entidad)
- JUA-110: Registrar venta desde la Ficha de cliente (modal)
- JUA-111: Registrar venta desde el módulo Ventas (alta con selector de cliente)
- JUA-112: Panel de Ventas — KPIs y selector de periodo (mes/trimestre/año)
- JUA-113: Panel de Ventas — desgloses (canal/responsable/cliente) y ventas recientes
- JUA-114: Navegación y permisos del módulo Ventas

### Mejora #3 — Seguimientos avanzados (JUA-115 a JUA-119)
Amplía el recordatorio simple del MVP.
- JUA-115: Recurrencia de seguimientos (una vez / semanal / mensual + fecha de fin)
- JUA-116: Seguimiento dirigido a empleado + agenda del empleado
- JUA-117: Reasignación de responsable del seguimiento
- JUA-118: Notificación al responsable + panel de supervisión del Administrador
- JUA-119: Pantalla "Programar seguimiento" — integración

### Mejora #4 — Ajustes del MVP tras diseño (JUA-120 a JUA-124)
- JUA-120: Pantalla "Perfil / Ajustes" (editar datos, cambiar contraseña, cerrar sesión)
- JUA-121: Gestión de usuarios — Reactivar usuario y Reenviar invitación
- JUA-122: Oportunidad — notas/motivo de cierre al marcar "Ganada"
- JUA-123: Canal de contacto — ampliar a 6 opciones (WhatsApp, Email, Web, Teléfono, Referido, Redes)
- JUA-124: Barra de fortaleza de contraseña (activación + recuperación)

### Puntos abiertos a decidir al programar
- **Nombre de producto:** ✅ unificado a **"InmoTech IA México"** (2026-07-06). Se corrigió la referencia "Vibe CRM" en Linear (JUA-85) y se renombraron los proyectos a "InmoTech IA México — MVP" y "InmoTech IA México — Resto del PRD".
- **Divisa/país:** importes en € con teléfonos +52 (México) y +34 (España) — definir divisa y prefijo por defecto.
- **Navegación:** barra inferior de 4 tabs vs 5 (con "Ventas"); "Pipeline" como tab sin pantalla de tablero diseñada (JUA-114).
- **JUA-120 (Perfil/Ajustes):** única pantalla sin `.dc.html` en el bundle; su diseño está en Claude Design (JUA-69/108).
- **Solape con "Resto del PRD":** el panel de Ventas cubre en parte "Resumen del mes" (JUA-34) y "Estado global" (JUA-35); revisar antes de programarlos.
