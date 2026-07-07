# Handoff: InmoTech IA México — CRM (PWA mobile)

## Overview
Paquete de referencia de diseño para el MVP del CRM mobile-first (PWA) de **InmoTech IA México**.
Equipos pequeños (1–10), perfil mixto **Administrador + Operativo**. Cubre autenticación, gestión de
clientes, oportunidades, agenda/seguimientos, ventas y administración.

Carácter de marca: limpio, profesional, confiable y sólido. Base **cream cálida** sobre **petróleo profundo**,
acento **dorado**, tipografía **Lora + Geist**.

## About the Design Files
Los ficheros `*.dc.html` de este bundle son **referencias de diseño creadas en HTML** (prototipos que
muestran el aspecto y comportamiento previstos), **no código de producción para copiar tal cual**.

La tarea es **recrear estos diseños en el entorno del repositorio destino** (React/React Native, Vue, Swift,
Flutter, etc.) usando sus patrones y librerías ya establecidos. Si aún no hay entorno, elegir el framework
más apropiado (para una PWA mobile, p. ej. React + Vite + Tailwind o similar) e implementarlos allí.

Cada fichero `.dc.html` es un **Design Component** que se abre directo en el navegador. Varios usan
**modo canvas** y muestran **varias variantes/estados de la misma pantalla** colocados lado a lado.
Identifica cada pantalla/estado por su atributo **`data-screen-label`** y por la etiqueta gris superior
("Variante 1 · …"). `support.js` es el runtime que renderiza los `.dc.html`; mantenlo junto a ellos para
poder abrirlos.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado y radios son finales y deben reproducirse con
precisión usando las librerías/patrones del codebase destino. Las medidas están pensadas para un viewport
de **390×844 px (iPhone 14 Pro)**; el marco de dispositivo (esquinas 30px, sombra) es solo presentación y
**no** forma parte de la UI a implementar.

---

## Design Tokens

### Color — Neutros cálidos
| Token | Hex | Uso |
|---|---|---|
| `bg` | `#FBF8F1` | Fondo de página (cream) |
| `surface` | `#FFFFFF` | Tarjetas, inputs |
| `neutral-50` | `#F4F1E9` | Fondos sutiles, segment track, disabled |
| `neutral-100` | `#ECE6DA` | **Borde por defecto** |
| `border-input` | `#DDD6C6` | Borde de inputs |
| `divider` | `#F1ECE3` | Divisor interno |
| `row-hover` | `#FAF7F0` | Hover de fila |
| `neutral-300` | `#CFC6B2` | Líneas/handles marcados |
| `neutral-400` | `#A7A395` | Iconos tenues |
| `neutral-500` | `#80847B` | Texto terciario / dots neutrales |
| `body` | `#5E6E70` | **Texto de cuerpo / secundario** |
| `muted` | `#9AA199` | Captions, placeholders |
| `ink` | `#15333A` | **Texto principal / titulares** |

### Color — Marca (Petróleo)
| Token | Hex | Uso |
|---|---|---|
| `teal-tint-bg` | `#E2EDEE` | Tinte avatar/badge petróleo |
| `teal-tint-border` | `#C9DDDF` | Borde tinte petróleo |
| `teal-tint-fg` | `#1C4E55` | Texto sobre tinte petróleo |
| `teal-700` | `#16454C` | Gradiente claro hero |
| `teal-800` | `#0E2E34` | **Superficie petróleo / nav activa / badge Admin** |
| `teal-900` | `#0B252A` | Gradiente profundo, overlays |
| overlay | `rgba(11,37,42,0.45)` | Overlay de modales/sheets |

### Color — Acento (Dorado)
| Token | Hex | Uso |
|---|---|---|
| `gold-tint` | `#F4ECDB` | Tinte dorado (chip activo, badge) |
| `gold-tint-border` | `#E0C795` | Borde tinte dorado |
| `gold-500` | `#C9A25E` | **Acento / botón primario / foco / selección** |
| `gold-600` | `#B68E45` | Hover primario / gradiente avatar |
| `gold-700` | `#9A7327` | Pressed / texto dorado sobre tinte |
| `gold-text` | `#A87E33` | Eyebrows y enlaces dorados sobre cream |

### Color — Semánticos (con tinte de badge)
| Rol | Dot/base | Badge bg | Badge fg |
|---|---|---|---|
| Success / Activo / Ganada | `#2E7D6B` | `#E2EFEB` | `#1B5446` |
| Warning / Media / Negociación | `#C9A25E` | `#F4ECDB` | `#9A7327` |
| Danger / Alta / Perdida | `#B0573F` | `#F6E7E0` | `#8A3F2C` |
| Info / Prospecto / En contacto | `#2E6E78` | `#E2EDEE` | `#1C4E55` |
| Neutral / Nuevo / Inactivo | `#80847B` | `#F0ECE2` | `#6B7268` |

### Mapeos de dominio (aplicados en las pantallas)
- **Prioridad:** Alta `#B0573F` · Media `#C9A25E` · Baja `#80847B`.
- **Estado de cliente:** Nuevo `#80847B` · Prospecto `#2E6E78` · Activo `#2E7D6B` · Inactivo `#C9A25E` · Descartado `#B0573F`.
- **Etapa pipeline:** Nueva `#80847B` · En contacto `#2E6E78` · Propuesta `#0E2E34` · Negociación `#C9A25E` · Ganada `#2E7D6B` · Perdida `#B0573F` · Cancelada `#A7A395`.
- **Regla:** el estado **nunca** se comunica solo por color → siempre **punto (6px) + texto**.

### Tipografía
- **Lora** (serif) — titulares, números/importes destacados. Pesos 500/600/700.
- **Geist** (sans) — interfaz y datos. Pesos 400/500/600/700.
- Import: `https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;0,700;1,500&family=Geist:wght@400;500;600;700&display=swap`

| Rol | Familia | Estilo | Color |
|---|---|---|---|
| Display / hero número | Lora | 600 · 36–38px · `-0.02em` | `#15333A` o `#F1EAD8` sobre petróleo |
| Título de pantalla (header) | Lora | 600 · 19–24px · `-0.01em` | `#15333A` |
| Título de sección (H3) | Lora | 600 · 18px | `#15333A` |
| Cuerpo | Geist | 400–500 · 14–15px · 1.5 | `#15333A` / `#5E6E70` |
| Caption | Geist | 500–600 · 12–13px | `#9AA199` |
| Eyebrow (sección) | Geist | 600 · 12px · `uppercase` · `0.1em` | `#A87E33` |
| Importe / métrica | Geist o Lora | 600 · `font-variant-numeric: tabular-nums` | `#15333A` (verde `#2E7D6B` si es venta) |

### Espacio, forma, elevación
- **Espaciado** (base 4): 4 · 8 · 12 · 16 · 20 · 24 · 32 px. Padding de página lateral: **16px**.
- **Radio:** inputs/botones `12px` · cards `16–18px` · pills/segment `999px` · sheet superior `24px` · modal `20px`.
- **Sombra:** `sm 0 1px 2px rgba(14,46,52,.05–.06)` · `md 0 2px 6px rgba(14,46,52,.08)` · `lg 0 16px 36px rgba(14,46,52,.10–.22)`.
- **Glow** (acento, sutil): radial `rgba(201,162,94,.25–.35)` para iconos/CTA destacados.

### Componentes base (patrones recurrentes)
- **Botón primario:** bg `#C9A25E`, texto `#15333A` 600, radio pill `999px` (o `24px`), sombra `0 2–4px 14px rgba(201,162,94,.32–.35)`, `min-height ≥ 44px`. **Una sola acción primaria por pantalla.**
- **Botón secundario:** bg `#FFFFFF`, borde `#DDD6C6`, texto `#15333A`.
- **Botón danger:** bg `#B0573F`, texto `#FFFFFF` 700, glow `rgba(176,87,63,.30)`.
- **Botón petróleo (fuerza):** bg `#0E2E34`, texto `#F3ECDC`.
- **Input:** alto 48px, borde `#DDD6C6`, radio 12px, icono Lucide 18px `#A7A395` a la izquierda. Focus: borde `#C9A25E` + `box-shadow 0 0 0 3px rgba(201,162,94,.18–.3)`. Error: borde `#B0573F` + `box-shadow 0 0 0 3px rgba(176,87,63,.14)`, mensaje `#8A3F2C` con icono alert-circle. Obligatorio: asterisco `#B0573F`.
- **Badge/estado:** pill radio 8px, padding `~4px 10px`, dot 6px + texto 12px 600.
- **Avatar:** círculo con iniciales (Lora 600). Admin/destacado: gradiente dorado `linear-gradient(140deg,#D2B074,#B68E45)` + glow. Tonos: teal `#E2EDEE/#1C4E55`, dorado `#F4ECDB/#9A7327`, neutral `#F0ECE2/#6B7268`, sage `#E8ECE2/#586353`, brick `#F6E7E0/#8A3F2C`.
- **Segmented control:** track `#F0ECE2` borde `#E0D9C9` radio 14px padding 5px; opción activa `#FFFFFF` + borde 1.5px del color semántico + sombra; opción inactiva texto `#5E6E70`.
- **Chips de canal** (`¿Cómo nos contactó?`): grid 3 columnas, chip vertical icono+label; activo = tinte dorado `#F4ECDB` + borde `#C9A25E`.
- **Card de lista** con acento de prioridad: `border-left: 3px solid <color prioridad>`.
- **Bottom nav:** fija, alto 84px (incl. safe-area 22px), `background: rgba(255,255,255,.92)` + `backdrop-filter: blur(20px)`, borde superior `#ECE6DA`. Activo `#0E2E34` (icono+label 600), inactivo `#9AA199`. Iconos Lucide ~21–22px.
- **Modal:** card `#FFFFFF` radio 20px, sombra lg, centrado, sobre overlay `rgba(11,37,42,.45)`.
- **Bottom sheet:** `#FFFFFF`, radio superior 24px, handle `40×4` `#E0D9C9`, entra desde abajo.
- **Iconos:** Lucide, stroke ~1.6–1.8px. Tamaños comunes 13/16/18/20/22px.

---

## Screens / Views

> Cada pantalla vive en un `.dc.html`. Muchas contienen **varias variantes/estados** (canvas) marcados con
> `data-screen-label`. Estructura común mobile: status bar (44px) → header (56px) → contenido scrollable
> (padding lateral 16px) → [bottom nav 84px si aplica]. Fondo de pantalla `#FBF8F1`.

### 1. Login — `Login.dc.html` (JUA-54)
- **Propósito:** autenticación. **4 estados:** Vacío, Error de credenciales, Cargando, Cuenta bloqueada.
- **Layout:** centrado vertical; wordmark "InmoTech **IA**" (IA en `#C9A25E`, Lora 30px) + subtítulo; card blanca (radio 20px, padding 24px) con título "Iniciar sesión", campos email/contraseña (icono mail/lock, toggle ojo), CTA dorada "Entrar", enlace "¿Olvidaste tu contraseña?" en `#A87E33`. Fondo con glow radial dorado sutil.
- **Estados:** Error → inputs borde `#B0573F` + mensaje. Cargando → spinner (borde 2.5px, `border-top:#15333A`, `@keyframes spin .7s linear infinite`) + "Verificando...", campos atenuados. Bloqueado → banner brick con candado + cuenta regresiva grande (`28:45`, Lora 38px), campos/botón deshabilitados.

### 2. Recuperar / Nueva contraseña — `Recuperar Password.dc.html` (JUA-55)
- **3 pasos + variantes:** P1 Solicitar (icono key, campo email, CTA) + variante error. P2 Confirmación (icono mail 56px con glow petróleo, "Revisa tu correo", botón ghost). P3 Nueva contraseña (icono candado, 2 campos con toggle ojo, **barra de fortaleza de 4 segmentos**: Débil `#B0573F` / Media `#C9A25E` / Fuerte `#2E7D6B` / Muy fuerte `#2E6E78`) + variante error + variante éxito (check-circle verde con glow, CTA "Ir a iniciar sesión").

### 3. Activación de cuenta — `Activacion Cuenta.dc.html` (JUA-56)
- **6 variantes** en 2 columnas. **Admin (3 pasos):** crear contraseña (progreso 1/3 + fortaleza), datos del negocio (nombre + zona horaria + nota info), bienvenida (sparkles dorado, glow animado `@keyframes glowpulse`). **Operativo (2 pasos):** crear contraseña (1/2), bienvenida (check-circle verde). **Estado:** enlace expirado (alert-triangle brick, botón ghost "Entendido").
- Indicador de progreso: segmento activo dorado (`26×7` radio 4) + dots neutrales; nombres del usuario en `#C9A25E`.

### 4. Inicio (Agenda + Inactividad) — `Inicio Home.dc.html` (JUA-57)
- **2 variantes:** con contenido y vacío. Header "Inicio" (Lora 24) + fecha (`#9AA199`) + avatar dorado.
- **Sección "Hoy":** 3 cards de recordatorio con `border-left` de prioridad, hora tabular, badge "Vencido", prioridad punto+texto, botón check verde (círculo 36px).
- **Sección "Requieren atención":** 4 clientes ordenados por prioridad; "Hace X días" coloreado por urgencia (brick/dorado), badge de estado.
- **Vacío:** empty states (calendar-check neutral; check-circle verde con glow "Todos tus clientes al día"). Bottom nav con "Inicio" activo.

### 5. Lista de clientes — `Lista Clientes.dc.html` (JUA-58)
- **4 variantes:** lista, búsqueda activa, sin resultados, filtros (sheet). Header "Clientes" + contador `24` en `#A87E33`. Buscador (icono lupa). Chips scrollables ("Todos" activo dorado + botón filtros). 
- **Card cliente:** `border-left` de prioridad; fila 1 nombre + badge estado; fila 2 "hace X días" semántico + etapa pipeline (dot+texto). **FAB** dorada (+). **Búsqueda:** input con valor + botón clear, "N resultados", coincidencias resaltadas (fondo `#F4ECDB`). **Sin resultados:** empty + botón ghost "Crear nuevo cliente". **Filtros (sheet):** secciones Estado (chips 2 col), Prioridad (chips), Ordenar por (radios; seleccionado anillo dorado), botones Limpiar + Aplicar.

### 6. Ficha de cliente — `Ficha Cliente.dc.html` (JUA-59)
- **3 variantes:** con contenido, cliente nuevo (sin historial), modal Registrar venta.
- **Perfil:** avatar 72px (dorado), nombre Lora 24, empresa, badges (Activo + Alta), alerta "Hace 23 días sin contacto" (`#B0573F`), separador, teléfono/email con botón circular de acción, y fila **Canal de contacto** (badge WhatsApp con icono).
- **Acciones rápidas:** 4 (Llamada/Reunión/Nota/Recordatorio). **Acciones principales:** "Programar seguimiento" (secundario) + "Registrar venta" (primario dorado).
- **Seguimientos pendientes:** mini-cards con `border-left`, icono, título, vencimiento, botón completar (check verde). **Oportunidades:** cards (título + etapa + importe verde + fecha de cierre, botón + dorado). **Historial:** timeline con conector vertical (`width:2px #F1ECE3`), icono por tipo (llamada teal, nota dorado, interno petróleo, reunión neutral, **venta** trophy verde). La entrada de venta indica *"el estado se mantiene en Activo"*.
- **Modal Registrar venta:** trophy dorado, selector Oportunidad, Importe (€), Fecha, **Registrado por** (empleado), nota de estado, CTA "Registrar venta" + "Cancelar".
- **Cliente nuevo:** empty states en Oportunidades e Historial; canal "Sin definir".

### 7. Nuevo cliente — `Nuevo Cliente Form.dc.html` (JUA-60)
- **3 variantes:** vacío (Operativo, Guardar deshabilitado), error de validación, rol Admin.
- **Secciones:** Datos básicos (Nombre* con asterisco brick + Teléfono con prefijo país), Información adicional (Email/Empresa opcionales), **¿Cómo nos contactó?** (grid 6 canales), Clasificación (Prioridad segmentada — Media por defecto; Estado segmentado — Nuevo por defecto). **Admin:** sección Asignación (selector Responsable). **Error:** Nombre borde brick + "El nombre es obligatorio".

### 8. Editar cliente — `Editar Cliente.dc.html` (JUA-67)
- **2 variantes:** formulario prerrellenado y confirmación "Mover a papelera".
- Igual estructura que Nuevo cliente pero con valores cargados; **Estado** como selector (no segmentado) con punto + "Activo"; canal WhatsApp ya marcado; sección Asignación; al pie botón **"Mover a papelera"** (tinte brick).
- **Modal "¿Mover a Ana García a la papelera?"**: trash brick, nota "restaurar 30 días", botones "Mover a papelera" (danger) + "Cancelar".

### 9. Nueva nota / Nuevo recordatorio — `Nota Recordatorio Form.dc.html` (JUA-61)
- **3 variantes:** Nueva nota (tipo Llamada), Nueva nota (Comentario interno), Nuevo recordatorio.
- **Nota:** fila "Para: <cliente>", grid 3×2 de tipos (Llamada/Reunión/Correo/Mensaje/Visita/Interno; activo dorado, "Interno" activo en petróleo), textarea 160px, Detalles (Fecha + Resultado con dot). **Interno:** banner informativo (tinte dorado, "no actualiza el contador de días sin contacto"). **Recordatorio:** card (Título con bell + Cliente), card Cuándo (Fecha/Hora tabular), Prioridad segmentada (Alta).

### 10. Nueva / Editar oportunidad — `Oportunidad Form.dc.html` (JUA-62)
- **3 variantes:** Nueva (vacío, Guardar off), Editar (Propuesta), Ganada (celebración).
- Fila "Para: <cliente>", Nombre*, **pipeline horizontal scrollable** (7 etapas, cada una con su dot de color; activa rellena con su color). Detalles (Monto € tabular, Fecha de cierre con chevron). **¿Cómo nos contactó?** (grid 6 canales). Notas (textarea). **Editar:** sección Administración (Responsable). **Ganada:** card de celebración (tinte verde, trophy dorado con glow, "¡Oportunidad ganada!", textarea de cierre) + confetti sutil verde/dorado de fondo.

### 11. Gestión de usuarios — `Gestion Usuarios.dc.html` (JUA-63, solo Admin)
- **2 variantes:** lista de usuarios y bottom sheet de invitación.
- Botón primario "Invitar usuario", sección "Equipo · N usuarios". **Cards de usuario:** avatar por tono, nombre + email, badges (rol Admin=petróleo / Operativo=neutral; estado Activo/Pendiente con clock/Inactivo), acción por estado (Revocar danger / Reenviar dorado / Reactivar secundario), badge "Tú" para la propia admin. **Sheet invitar:** handle, título Lora, Email* (icono mail, asterisco), Nombre opcional, fila Rol (badge "Operativo"), CTA "Enviar invitación" + "Cancelar".

### 12. Papelera de clientes — `Papelera Clientes.dc.html` (JUA-64, solo Admin)
- **3 variantes:** lista, vacío, modal de eliminación definitiva.
- Header back + "Papelera" + "Vaciar todo" (`#B0573F` texto). Subtítulo muted. **Cards atenuadas** (tonos grises, opacity reducida): avatar neutral, nombre `#5E6E70`, empresa, "Eliminado hace X días" con clock, acciones pill 32px Restaurar (tinte petróleo) / Eliminar (tinte brick). **Vacío:** trash-2 64px con glow azul/petróleo, "La papelera está vacía". **Modal:** alert-triangle brick con glow, "¿Eliminar a Ana García?", texto irreversibilidad, botones stacked "Eliminar para siempre" (danger sólido) + "Cancelar".

### 13. Programar seguimiento — `Programar Seguimiento.dc.html` (JUA-66)
- **3 variantes:** seguimiento a cliente, a empleado, redirigir (sheet).
- Header X + "Programar seguimiento" (16px para no chocar con Guardar) + Guardar dorado. **Segmentado Cliente | Empleado.** Selector de cliente/empleado (avatar + meta + chevron), Título (bell), Cuándo (Fecha/Hora), Prioridad segmentada, **Frecuencia segmentada** (Una vez / Semanal / Mensual; Semanal muestra nota "se repetirá cada lunes"). **Cliente:** sección "Asignar seguimiento a" con responsable + "Cambiar" (redirigible). **Empleado:** toggle "Notificar a Carlos" + nota de supervisión. **Redirigir (sheet):** lista del equipo con radios/check para reasignar responsable.

### 14. Ventas — `Ventas.dc.html` (extra — panel y alta de ventas)
- **4 variantes:** panel con datos, vacío, selector de cliente (sheet), registrar venta (alta).
- **Panel:** header "Ventas" + avatar; chips de periodo (Este mes/Trimestre/Año); **desplegable de cliente** ("Todos los clientes · 24 ▾"); **hero petróleo** (gradiente `#16454C→#0E2E34`, eyebrow dorado, total `€24.800` Lora 38, delta +18%); 2 KPIs (Ventas, Ticket medio); **Por canal** (barras horizontales por origen, ancho = %); **Por responsable** (ranking con avatar + importe); **Ventas recientes** (cliente, importe verde, canal, responsable, fecha). **FAB "Nueva venta"** dorada.
- **Vacío:** banknote dorado + "Aún no hay ventas" + CTA "Ir a clientes".
- **Selector de cliente (sheet):** "Ventas por cliente", buscador, lista con total por cliente (Todos seleccionado), CTA "Ver ventas".
- **Registrar venta (alta):** header "Registrar venta" + Guardar; Cliente* (selector), Venta (Importe € grande, Fecha, Oportunidad), **¿Cómo nos contactó?**, Registrado por (empleado), nota "se añade al historial, estado se mantiene en Activo".

---

## Interactions & Behavior
- **Navegación:** back (chevron-left) y close (X) en headers; bottom nav fija para secciones raíz (Inicio, Clientes, Ventas, Pipeline, Ajustes). *Nota: la nav con "Ventas" (5 tabs) aparece en `Ventas.dc.html`; en `Inicio`/`Lista` está la versión de 4 tabs — unificar al implementar.*
- **Guardar:** deshabilitado (bg `#F4F1E9`, texto `#9AA199`) mientras falten obligatorios; activo en dorado tras intento/validez.
- **Validación de formularios:** Nombre/Email/Importe obligatorios → borde `#B0573F` + `box-shadow 0 0 0 3px rgba(176,87,63,.14)` + mensaje inline `#8A3F2C` con alert-circle. Email con formato válido.
- **Segmented / chips / radios:** selección única; activo recibe el tratamiento de color del token correspondiente (dorado para tabs/canal/frecuencia; color semántico para prioridad/estado).
- **Modales y sheets:** overlay `rgba(11,37,42,.45)`; sheets entran desde abajo (transición translateY); modales centrados (fade + scale). Acción destructiva siempre con confirmación.
- **Registrar venta:** añade entrada al **historial** del cliente y suma a **Ventas** (por canal y por responsable). **No** modifica el estado del cliente (se mantiene Activo).
- **Programar seguimiento:** soporta destino cliente o empleado, recurrencia (una vez/semanal/mensual con fecha fin opcional) y reasignación de responsable.
- **Animaciones:** spinner de carga (`spin .7s linear infinite`); glow pulsante en pantallas de éxito (`glowpulse 2.6s ease-in-out infinite`). Mantener microinteracciones discretas.
- **Permisos por rol:** secciones marcadas "solo Admin" (Gestión de usuarios, Papelera, Asignación/Responsable, seguimiento a empleados, supervisión) deben ocultarse/bloquearse para Operativo.

## State Management
- **Auth:** sesión, estados login (idle/loading/error/locked + bloqueo temporizado), flujo recuperación, flujo activación (admin 3 pasos / operativo 2 pasos), token de invitación (válido/expirado).
- **Clientes:** lista con filtros (estado, prioridad, orden), búsqueda (query → resultados/empty), CRUD (alta, edición, mover a papelera/restaurar/eliminar definitivo), canal de contacto, responsable asignado.
- **Oportunidades:** etapa del pipeline, monto, fecha de cierre, canal, responsable, notas; transición a Ganada/Perdida.
- **Interacciones/Agenda:** notas (incl. internas), recordatorios y seguimientos (cliente/empleado, fecha/hora, prioridad, recurrencia, responsable), contador "días sin contacto".
- **Ventas:** registro de venta (cliente, importe, fecha, oportunidad, canal, empleado), agregados por periodo / canal / responsable / cliente.
- **Usuarios (Admin):** equipo, roles (Admin/Operativo), estados (Activo/Pendiente/Inactivo), invitaciones.

## Assets
- **Iconos:** [Lucide](https://lucide.dev) (inline SVG en los prototipos). Sustituir por la librería de iconos del codebase (Lucide React/Vue u otra equivalente), stroke ~1.6–1.8px.
- **Tipografías:** Google Fonts **Lora** y **Geist** (ver import arriba). Si el proyecto las autoaloja, mantener pesos indicados.
- **Imágenes:** no se usan fotos; los avatares son iniciales sobre tinte. Las barras/gráficas de Ventas son CSS (no librería de charting); puede reimplementarse con la librería de charts del codebase respetando los colores.
- **Marca:** wordmark textual "InmoTech **IA**" (IA en dorado). No hay logotipo de imagen.

## Files
Prototipos de diseño (Design Components HTML) incluidos en este bundle — abrir con un servidor estático
(necesitan `support.js` al lado):

- `Login.dc.html` — JUA-54
- `Recuperar Password.dc.html` — JUA-55
- `Activacion Cuenta.dc.html` — JUA-56
- `Inicio Home.dc.html` — JUA-57
- `Lista Clientes.dc.html` — JUA-58
- `Ficha Cliente.dc.html` — JUA-59
- `Nuevo Cliente Form.dc.html` — JUA-60
- `Nota Recordatorio Form.dc.html` — JUA-61
- `Oportunidad Form.dc.html` — JUA-62
- `Gestion Usuarios.dc.html` — JUA-63
- `Papelera Clientes.dc.html` — JUA-64
- `Programar Seguimiento.dc.html` — JUA-66
- `Editar Cliente.dc.html` — JUA-67
- `Ventas.dc.html` — panel + alta de ventas (extra)
- `support.js` — runtime para renderizar los `.dc.html` (no es parte de la app)

> Cada fichero usa **modo canvas**: localiza cada pantalla/estado por `data-screen-label`. El marco de
> teléfono (390×844, esquinas 30px) es solo presentación.
