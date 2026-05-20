---
name: Turnly Admin
description: Sistema visual del shell admin-v2 — coral disciplinado sobre neutros zinc-cool, mobile-first, calma operativa.
colors:
  coral-mostrador: "#F2693A"
  coral-mostrador-hover: "#D9501F"
  coral-mostrador-soft: "#FDEEE6"
  coral-mostrador-deep: "#B23E16"
  algodon-tibio: "#FAFAFB"
  papel-mostrador: "#FFFFFF"
  niebla-clara: "#F4F5F7"
  niebla-media: "#EEF0F3"
  borde-suave: "#E4E7EC"
  borde-firme: "#D6DAE0"
  ceniza-baja: "#8B92A0"
  ceniza-media: "#6B7280"
  ceniza-firme: "#4B5462"
  ceniza-profunda: "#2E3441"
  tinta-noche: "#0E121A"
  verde-cita: "#0F9D58"
  ambar-pendiente: "#E89320"
  rojo-cancelado: "#DC2A3A"
  azul-confirmado: "#1E88F5"
typography:
  display:
    fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.04em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "13px"
    fontWeight: 400
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  "2xl": "16px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.coral-mostrador}"
    textColor: "{colors.papel-mostrador}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.coral-mostrador-hover}"
    textColor: "{colors.papel-mostrador}"
  button-secondary:
    backgroundColor: "{colors.niebla-clara}"
    textColor: "{colors.ceniza-profunda}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.papel-mostrador}"
    textColor: "{colors.ceniza-profunda}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ceniza-profunda}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  button-destructive:
    backgroundColor: "{colors.rojo-cancelado}"
    textColor: "{colors.papel-mostrador}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  input-default:
    backgroundColor: "{colors.papel-mostrador}"
    textColor: "{colors.ceniza-profunda}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
    typography: "{typography.body}"
  card-default:
    backgroundColor: "{colors.papel-mostrador}"
    textColor: "{colors.ceniza-profunda}"
    rounded: "{rounded.xl}"
    padding: "24px"
  badge-status-pending:
    backgroundColor: "#FFF6E0"
    textColor: "#B47114"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
    typography: "{typography.label}"
  badge-status-confirmed:
    backgroundColor: "#E4F1FE"
    textColor: "#1666BF"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
    typography: "{typography.label}"
  badge-status-completed:
    backgroundColor: "#E8F8F0"
    textColor: "#0B7A44"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
    typography: "{typography.label}"
  badge-status-cancelled:
    backgroundColor: "#FCE9EB"
    textColor: "#A91D2C"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
    typography: "{typography.label}"
---

# Design System: Turnly Admin

## 1. Overview

**Creative North Star: "El Mostrador"**

El sistema visual de Turnly Admin se construye sobre la metáfora del mostrador: la superficie ordenada donde un dueño de barbería en Ibarra atiende, agenda y cobra al mismo tiempo. No es escritorio corporativo gringo, no es POS de los noventa, no es laboratorio tech oscuro. Es un mostrador limpio, de luz tibia, donde cada objeto tiene su lugar y la mirada cae primero en lo que hay que hacer ahora.

Coral disciplinado sobre neutros zinc-cool. El coral (`#F2693A`) actúa como gesto del dueño señalando "esto sigue" — botón principal, estado activo, foco de atención. Todo lo demás respira en grises tibios y blancos cremosos para que el coral nunca compita consigo mismo. La tipografía Roboto en pesos contrastados (800 display vs. 400 body) da jerarquía clara sin gritos editoriales. JetBrains Mono aparece solo cuando la cifra importa — horas, montos, IDs.

**Key Characteristics:**
- Mobile-first 375px como regla, no afterthought
- Coral en ≤10% de cualquier pantalla — disciplina, no decoración
- Tap targets 44px+ siempre, sin excepciones
- Densidad media: respiración generosa en zonas críticas, densidad calma solo en tablas de inspección
- Sombras mínimas y funcionales, jerarquía por borde y color
- Cero modo oscuro por defecto: el mostrador es de día

## 2. Colors

Paleta cálida-cool: coral suntuoso y único, neutros con micro-tinte azul para que respiren modernos sin volverse fríos.

### Primary
- **Coral Mostrador** (`#F2693A`): el único acento de marca. Botón principal, link activo, indicador de día actual, estado seleccionado. Nunca como fondo grande; es siempre un gesto.
- **Coral Mostrador Hover** (`#D9501F`): solo en hover de botón primario y links activos.
- **Coral Mostrador Suave** (`#FDEEE6`): fondo de chip "destacado", highlight de fila seleccionada en tabla, fondo de slot con cita propia del usuario.
- **Coral Mostrador Profundo** (`#B23E16`): texto coral sobre fondo blanco cuando se necesita contraste 4.5:1+.

### Secondary

No hay color secundario. El sistema es de un solo acento por diseño. Los colores semánticos (status, success, danger) cumplen el rol de "secundarios funcionales" sin compartir la jerarquía del coral.

### Tertiary

No aplica.

### Neutral
- **Algodón Tibio** (`#FAFAFB`): fondo de la app. Casi blanco, con el más leve tinte cool para que no parezca papel viejo.
- **Papel Mostrador** (`#FFFFFF`): superficie de tarjetas, modales, popovers, inputs. El blanco "limpio" del mostrador.
- **Niebla Clara** (`#F4F5F7`): zonas hundidas, fondo de inputs deshabilitados, hover de filas en tabla.
- **Niebla Media** (`#EEF0F3`): hover de elementos interactivos secundarios (ghost button hover, item de menú activo).
- **Borde Suave** (`#E4E7EC`): borde de tarjetas, separadores ligeros, bordes de inputs en estado por defecto.
- **Borde Firme** (`#D6DAE0`): borde de botones outline, separadores de sección.
- **Ceniza Baja** (`#8B92A0`): texto muteado, placeholder, iconos secundarios.
- **Ceniza Media** (`#6B7280`): texto secundario (subtítulos, metadatos, "hace 3 min").
- **Ceniza Firme** (`#4B5462`): texto de cuerpo en tablas, navegación inactiva.
- **Ceniza Profunda** (`#2E3441`): texto principal, párrafos, valores en formularios.
- **Tinta Noche** (`#0E121A`): solo titulares y números clave que deben anclar la mirada.

### Estado de Reservas (paleta semántica fija)
- **Ámbar Pendiente** (fg `#B47114` / bg `#FFF6E0`): cita pendiente de confirmación.
- **Azul Confirmado** (fg `#1666BF` / bg `#E4F1FE`): cita confirmada por el cliente.
- **Verde Cita Cumplida** (fg `#0B7A44` / bg `#E8F8F0`): servicio completado.
- **Rojo Cancelado** (fg `#A91D2C` / bg `#FCE9EB`): cancelación.
- **Ceniza No-Show** (fg `#4B5462` / bg `#EEF0F3`): cliente no se presentó.

### Paletas de Tenant (curadas, 6)
Para distinguir negocios en super-admin sin romper la coherencia del shell: cobalto, esmeralda, ámbar, rosa, violeta, pizarra. Nunca aparecen en el shell del propio tenant; viven solo en la vista cross-tenant.

### Named Rules

**La Regla del Único Coral.** El coral es uno y es escaso. Aparece en ≤10% del píxel de cualquier pantalla. Si dos elementos coral compiten, uno está mal. Botón primario por contexto, no varios coral simultáneos.

**La Regla del Estado por Pareja.** Todo estado de reserva combina color + etiqueta de texto. Nunca color solo. El daltónico debe poder operar la app sin pérdida.

**La Regla del Mostrador Limpio.** El fondo de la app es Algodón Tibio, las superficies son Papel Mostrador. Nunca al revés. El usuario opera sobre el blanco, no debajo de él.

## 3. Typography

**Display Font:** Roboto (con fallback `ui-sans-serif`, `system-ui`)
**Body Font:** Roboto (mismo stack)
**Mono Font:** JetBrains Mono (con fallback `ui-monospace`, `SFMono-Regular`)

**Character:** Roboto en pesos contrastados (800 display vs. 400 body, ratio 2x) carga toda la jerarquía. No hay serif, no hay tipografía editorial. El sistema confía en peso, escala y espaciado para distinguir niveles. JetBrains Mono entra solo donde la legibilidad numérica importa: horarios, precios, IDs, totales. El font-stretch 90% en displays aprieta los titulares para que sientan "trabajados", no por defecto.

### Hierarchy
- **Display** (Roboto 800, 38px, line-height 1.15, letter-spacing -0.02em, font-stretch 90%): título de página principal en escritorio. En mobile baja a 30px.
- **Headline** (Roboto 700, 24px, line-height 1.3, letter-spacing -0.01em): título de sección, encabezado de modal.
- **Title** (Roboto 600, 17px, line-height 1.3): título de tarjeta, header de tabla principal.
- **Subtitle** (Roboto 600, 15px): título de sub-sección, label de formulario destacado.
- **Body** (Roboto 400, 14px, line-height 1.5): texto general, párrafo, valor de input. Línea máxima 65–75ch en lectura larga.
- **Caption** (Roboto 400, 12.5px, line-height 1.3, color Ceniza Media): metadato, timestamp, ayuda bajo input.
- **Eyebrow** (Roboto 600, 11px, letter-spacing 0.04em, UPPERCASE, color Ceniza Baja): categoría sobre título, etiqueta de zona.
- **Mono Tabular** (JetBrains Mono 400, 13px, font-feature-settings "tnum" + "zero"): horarios, precios, números en tabla.

### Named Rules

**La Regla del Peso Doble.** La jerarquía se construye con peso, no solo con tamaño. Display es 800 contra 400 de body. Un título sin contraste de peso es un título perdido.

**La Regla del Mono Funcional.** JetBrains Mono solo donde el ojo lee cifras: horas, precios, IDs, contadores. Nunca como decoración "tech".

**La Regla del 14 Mínimo.** Texto de cuerpo nunca baja de 14px. Los dueños de negocio en Ibarra promedian 40+; el cuerpo de 13px es prohibido.

## 4. Elevation

Sistema casi plano por convicción. La jerarquía nace del borde y del color, no de la sombra. Las sombras existen pero son ambient: una sutil insinuación de capa, nunca un efecto. El mostrador no tiene sombras dramáticas; tiene luz uniforme y objetos con bordes claros.

### Shadow Vocabulary

- **shadow-xs** (`0 1px 0 0 rgba(15, 18, 26, 0.04)`): tarjeta en reposo. Una hairline, casi imperceptible. Es la sombra "default".
- **shadow-sm** (`0 1px 2px 0 rgba(15, 18, 26, 0.05), 0 1px 1px 0 rgba(15, 18, 26, 0.04)`): hover de tarjeta interactiva, dropdown trigger en focus.
- **shadow-md** (`0 4px 12px -2px rgba(15, 18, 26, 0.08), 0 2px 4px -2px rgba(15, 18, 26, 0.04)`): popover, tooltip, menú contextual flotante.
- **shadow-lg** (`0 14px 32px -8px rgba(15, 18, 26, 0.12), 0 4px 8px -4px rgba(15, 18, 26, 0.06)`): sheet lateral, drawer en mobile.
- **shadow-pop** (`0 24px 48px -12px rgba(15, 18, 26, 0.18)`): modal centrado, dialog crítico.

### Named Rules

**La Regla del Plano por Defecto.** Las superficies son planas en reposo. La sombra aparece como respuesta de estado (hover, focus, capa flotante). Una tarjeta con `shadow-md` permanente es prohibido.

**La Regla del Borde Antes que Sombra.** Si la jerarquía se puede resolver con borde o color de fondo, se resuelve así. La sombra es el último recurso, no el primero.

## 5. Components

### Buttons

**Personalidad:** firmes, mansos, no exhibicionistas. El botón primario es el único elemento coral en pantalla; los demás botones son neutros que se hacen visibles solo cuando se necesitan.

- **Shape:** radio 10px (`{rounded.lg}`), un poco menos cuadrado que las tarjetas para sentirse "presionable".
- **Primary:** fondo Coral Mostrador (`#F2693A`), texto blanco, padding `8px 16px`, altura 40px, peso 500.
  - Hover: fondo Coral Mostrador Hover (`#D9501F`), `transition-duration: 120ms`, `transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1)`.
  - Active: `transform: scale(0.97)` (feedback táctil obligatorio en mobile).
  - Focus-visible: `box-shadow: 0 0 0 3px rgba(42, 109, 244, 0.20)` (anillo azul, no coral, para no canibalizar el botón).
- **Secondary:** fondo Niebla Clara, texto Ceniza Profunda. Para acción importante pero no la principal de la pantalla.
- **Outline:** fondo blanco, borde Borde Firme (`#D6DAE0`), texto Ceniza Profunda. Para "Cancelar", "Volver".
- **Ghost:** sin fondo, texto Ceniza Profunda. Hover: fondo Niebla Media. Para acción terciaria, item de menú.
- **Destructive:** fondo Rojo Cancelado (`#DC2A3A`), texto blanco. Solo confirma acciones destructivas en modal, nunca el primer botón visible.
- **Sizes:** sm (h-9, px-3), default (h-10, px-4), lg (h-11, px-8), icon (h-10 w-10). En mobile, default sube a h-11 implícito por tap target.

### Chips / Status Badges

**Personalidad:** pareja color + texto, redonditos, legibles a un vistazo en tabla densa.

- **Shape:** pill (`border-radius: 999px`), padding `2px 10px`.
- **Tipografía:** label 11px peso 600, letter-spacing 0.04em (sin uppercase aquí; el negocio quiere leer "Confirmado", no "CONFIRMADO").
- **Variantes (estado de reserva):** par fg/bg fijo por estado. Ver paleta semántica en sección Colors.
- **Borde:** ninguno; el contraste fg/bg ya es suficiente.

### Cards / Containers

**Personalidad:** la tarjeta es un objeto sobre el mostrador. Bordeada, no flotante. Plana.

- **Corner Style:** radio 12px (`{rounded.xl}`).
- **Background:** Papel Mostrador (`#FFFFFF`).
- **Border:** 1px Borde Suave (`#E4E7EC`).
- **Shadow Strategy:** `shadow-xs` en reposo, `shadow-sm` en hover si la tarjeta es interactiva. Tarjetas no-interactivas mantienen `shadow-xs` siempre.
- **Internal Padding:** 24px (`{spacing.6}`) por defecto. 16px en mobile cuando la tarjeta ocupa todo el ancho.
- **Header / Content / Footer:** divisiones internas por espaciado, no por separator-line. Si hay separador es 1px Borde Suave.

### Inputs / Fields

**Personalidad:** discretos, claros, con foco firme. La caja de texto debe sentirse confiable, no decorativa.

- **Shape:** radio 8px (`{rounded.md}`).
- **Default:** fondo blanco, borde 1px Borde Suave, padding `8px 12px`, altura 40px (44px implícito en mobile vía tap area).
- **Tipografía:** body 14px, color Ceniza Profunda. Placeholder Ceniza Baja.
- **Focus:** `box-shadow: 0 0 0 3px rgba(42, 109, 244, 0.20)` + borde a Borde Firme. Sin glow coral (el coral es para acción, no para foco).
- **Error:** borde Rojo Cancelado, `box-shadow: 0 0 0 3px rgba(220, 42, 58, 0.20)`. Mensaje de error debajo en caption rojo, no encima.
- **Disabled:** fondo Niebla Clara, opacity 0.6, cursor not-allowed.

### Navigation

- **Sidebar (desktop):** ancho 240px, fondo Papel Mostrador, borde derecho Borde Suave. Items con padding `8px 12px`, radio 8px en hover/active.
  - Default: texto Ceniza Firme, ícono mismo color.
  - Hover: fondo Niebla Media.
  - Active: fondo Coral Suave (`#FDEEE6`), texto Coral Mostrador Profundo (`#B23E16`), ícono Coral Mostrador.
- **Bottom nav (mobile):** altura 64px (incluye safe-area), 4-5 items principales (Hoy, Reservas, Clientes, Más). Activo: ícono Coral Mostrador + label Coral Mostrador Profundo. Inactivo: Ceniza Baja.
- **Top bar:** altura 56px desktop, 48px mobile. Logo + nombre tenant a la izquierda; avatar + notificaciones a la derecha.

### Tables

**Personalidad:** densas en lectura, no en pixel. Headers anclados, filas con respiración.

- **Header:** fondo Niebla Clara, texto eyebrow (11px peso 600 uppercase letter-spacing 0.04em), color Ceniza Baja. Altura 40px.
- **Row:** altura 52px en desktop, 64px en mobile. Borde inferior 1px Borde Suave. Hover: fondo Niebla Clara.
- **Selected row:** fondo Coral Suave, borde izquierdo prohibido (ver Don'ts).
- **Numbers:** JetBrains Mono tabular para precios, horas, totales.

### Signature Component: La Agenda del Día

El componente nuclear del producto. Lista vertical de slots de tiempo en mobile, cuadrícula de columnas-por-staff en desktop.

- **Slot vacío:** fondo Niebla Clara, borde 1px dashed Borde Suave, altura proporcional a duración.
- **Slot con cita:** fondo Papel Mostrador, borde-superior 3px del color de estado (NO border-left, ver Don'ts), padding 12px, radio 8px.
- **Slot actual (hora vigente):** badge "AHORA" en eyebrow Coral Mostrador, línea horizontal punteada Coral Mostrador a través de la columna.
- **Walk-in inline:** botón "+ Walk-in" siempre visible al final del slot vacío, ghost variant con ícono lucide.
- **Drag/tap reagendar:** `cursor: grab` en desktop; long-press 500ms en mobile dispara modo arrastre con feedback haptic si está disponible.

## 6. Do's and Don'ts

### Do:

- **Do** usar Coral Mostrador (`#F2693A`) solo en el botón principal y el estado activo de la pantalla actual. Un coral por pantalla.
- **Do** combinar siempre color + etiqueta de texto en chips de estado. "Confirmado" + azul, no solo el azul.
- **Do** mantener tap targets ≥ 44×44px en toda interacción mobile, sin excepciones.
- **Do** respetar `prefers-reduced-motion` deshabilitando transiciones no esenciales en framer-motion.
- **Do** usar JetBrains Mono con `font-feature-settings: "tnum" 1` en horarios, precios y totales para que las cifras alineen verticalmente en tablas.
- **Do** apoyarse en borde + color de fondo para jerarquía antes de tirar una sombra.
- **Do** diseñar a 375px primero. Desktop expande la composición; no la define.
- **Do** mantener línea de cuerpo entre 65–75ch en zonas de lectura (descripciones largas, notas).
- **Do** anclar el contraste de texto principal en Ceniza Profunda (`#2E3441`) sobre Papel Mostrador o Algodón Tibio. Nunca texto en Ceniza Baja como cuerpo.

### Don't:

- **Don't** parecerse a Calendly o Acuity. Si la pantalla termina blanca-y-azul-genérica con tipografía ligera y bullets corporativos, está mal. Es un mostrador en Ibarra, no un SaaS gringo.
- **Don't** parecerse a un POS Windows de los 2000. Tablas planas grises, tipografía sin jerarquía, bordes duros: prohibido.
- **Don't** parecerse a Material Design plano por defecto: ripples, FABs flotantes, sombras genéricas, ícono-grande-arriba-de-card. Eso es prototipo Google, no Turnly.
- **Don't** parecerse a Stripe/Linear: dashboards oscuros con neón violeta, sidebars negros con acentos de gradiente. El público de Turnly opera en luz de día sobre un mostrador real.
- **Don't** usar `border-left` o `border-right` mayor a 1px como acento de color en tarjetas, slots, alertas o filas. Si el slot necesita color de estado, va `border-top` 3px o tinte de fondo, nunca stripe lateral.
- **Don't** usar `background-clip: text` para gradientes en titulares. Coral Mostrador sólido o nada.
- **Don't** usar glassmorphism (blur de fondo, "glass cards") como decoración. No hay un solo caso justificado en Turnly Admin.
- **Don't** caer en el template hero-metric (número grande + label chico + barrita de gradiente). Si hay que mostrar una métrica, va en contexto, con su unidad y su comparativo, no aislada como cliché SaaS.
- **Don't** apilar grids idénticas de tarjetas con ícono + título + texto. Variar la composición; no toda sección es "feature grid".
- **Don't** abrir un modal como primera opción. Inline edit, popover, sheet, panel: agotar antes de modal. El modal interrumpe; el negocio no se puede interrumpir cada cinco segundos.
- **Don't** usar texto en gris claro (Ceniza Baja `#8B92A0`) como cuerpo principal. Es para muteado únicamente. Cuerpo va en Ceniza Profunda.
- **Don't** activar dark mode por defecto. Si llega como feature, va opt-in y se diseña como sistema separado, no inversión automática de tokens.
- **Don't** usar em dashes (—) ni dobles guiones (--) en copy. Comas, dos puntos, punto y coma, paréntesis.
- **Don't** dejar `outline: none` sin reemplazo. El anillo de foco azul (`rgba(42, 109, 244, 0.20)`, 3px) es obligatorio en cualquier elemento focusable.
