# Turnly "Electric Indigo" UI/UX Redesign

## Overview

Full visual redesign of the Turnly admin app — landing page, auth screens, dashboard, and all internal pages. Style: modern SaaS inspired by Linear/Cal.com with gradient accents, glassmorphism, dark sidebar, and micro-animations.

Tech stack remains unchanged: Next.js + Tailwind CSS 4 + shadcn/ui + Lucide icons.

---

## 1. Color Palette & Tokens

### Light Mode (`:root`)

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#6366F1` (indigo-500) | Buttons, active states, links |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--accent` | `#8B5CF6` (violet-500) | Gradients, highlights |
| `--accent-foreground` | `#FFFFFF` | Text on accent |
| `--secondary` | `#F1F5F9` (slate-100) | Secondary buttons, muted bg |
| `--secondary-foreground` | `#334155` (slate-700) | Text on secondary |
| `--background` | `#F8FAFC` (slate-50) | Page background |
| `--foreground` | `#0F172A` (slate-900) | Primary text |
| `--muted` | `#F1F5F9` (slate-100) | Muted backgrounds |
| `--muted-foreground` | `#64748B` (slate-500) | Secondary text, placeholders |
| `--card` | `#FFFFFF` | Card backgrounds |
| `--card-foreground` | `#0F172A` | Card text |
| `--border` | `#E2E8F0` (slate-200) | Borders |
| `--input` | `#E2E8F0` | Input borders |
| `--ring` | `#6366F1` | Focus rings |
| `--destructive` | `#EF4444` | Error, delete actions |
| `--chart-1` | `#6366F1` | Indigo |
| `--chart-2` | `#06B6D4` | Cyan |
| `--chart-3` | `#10B981` | Emerald |
| `--chart-4` | `#8B5CF6` | Violet |
| `--chart-5` | `#F59E0B` | Amber |
| `--sidebar` | `#0F172A` (slate-900) | Sidebar background |
| `--sidebar-foreground` | `#94A3B8` (slate-400) | Sidebar inactive text |
| `--sidebar-primary` | `#FFFFFF` | Sidebar active text |
| `--sidebar-primary-foreground` | `#FFFFFF` | Sidebar active text |
| `--sidebar-accent` | `rgba(255,255,255,0.1)` | Sidebar active bg |
| `--sidebar-accent-foreground` | `#FFFFFF` | Sidebar active text |
| `--sidebar-border` | `rgba(255,255,255,0.05)` | Sidebar separators |

### Gradients (Tailwind classes)

- **Primary gradient**: `bg-gradient-to-r from-indigo-500 to-violet-600`
- **Hero mesh**: `bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500`
- **Accent gradient**: `bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400`
- **Sidebar active border**: 3px left border with indigo→violet gradient

### Border Radius

| Token | Value |
|-------|-------|
| `--radius` | `1rem` (16px) |
| Cards | `1rem` |
| Buttons | `0.625rem` (10px) |
| Inputs | `0.625rem` |

### Shadows

- **Card default**: `0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(99,102,241,0.06)`
- **Card hover**: `0 2px 6px rgba(0,0,0,0.06), 0 8px 24px rgba(99,102,241,0.10)`
- **Elevated**: `0 4px 12px rgba(0,0,0,0.08), 0 16px 48px rgba(99,102,241,0.12)`

### Typography

- Font: **Inter** (unchanged) — weights 400, 500, 600, 700
- Headings: weight 700, `tracking-tight`
- Body: weight 400-500

---

## 2. Landing Page (`/`)

### Navbar
- Transparent bg → `backdrop-blur-xl bg-white/70 border-b border-slate-200/50` on scroll
- Left: Logo "Turnly" with small calendar icon in gradient
- Center/Right: "Características", "Precios" (placeholder links)
- Far right: "Iniciar sesion" text link + "Empezar gratis" gradient button (rounded-full)

### Hero Section
- Full-width gradient mesh background: `from-indigo-600 via-violet-600 to-cyan-500`
- Animated mesh movement via CSS `@keyframes` (subtle background-position shift)
- Content centered, white text:
  - Badge: pill with glass bg (`bg-white/10 backdrop-blur border border-white/20`), text "La plataforma #1 de reservas"
  - H1 `text-5xl md:text-6xl font-bold tracking-tight`: "Gestiona tu negocio, acepta reservas online"
  - Subtitle `text-lg text-white/70`: "Turnly es la plataforma de citas y servicios para cualquier negocio"
  - Two buttons: 
    - Primary: white bg, indigo text, rounded-full
    - Secondary: glass (`bg-white/10 backdrop-blur border border-white/20 text-white`)
- Below: Dashboard mockup/screenshot with `perspective(1000px) rotateX(5deg)` transform, elevated shadow, rounded corners

### Features Section
- White/slate-50 background
- 3 cards in grid:
  - White bg, subtle border `border-slate-200/50`
  - Icon in circle with gradient bg (indigo→violet), white icon
  - Title: font-semibold, slate-900
  - Description: text-sm, slate-500
  - Hover: `translate-y -2px` + card hover shadow, `transition-all duration-300`

### Social Proof
- Centered text: "Negocios que confian en Turnly"
- Counter or placeholder logos: "+500 negocios activos"
- Muted colors, subtle

### CTA Section
- Large card with gradient bg (indigo→violet)
- White text: "Empieza gratis hoy"
- Subtitle: "Sin tarjeta de credito requerida"
- White button with indigo text

### Footer
- Minimal, columns with links
- Slate-500 text on white bg
- Copyright line

---

## 3. Auth Pages (`/login`, `/register`)

### Layout: Immersive Gradient
- Full-screen animated gradient background (same mesh as hero: indigo→violet→cyan)
- CSS animated `background-position` or `background-size` shift
- Centered glassmorphism card:
  - `bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl`
  - Shadow: `0 8px 32px rgba(0,0,0,0.2)`
  - Max-width: `sm` (24rem / 384px)
  - Padding: generous (p-8)

### Login Card Content
- Logo "Turnly" white, centered
- Title: "Bienvenido de vuelta" (white, font-bold)
- Subtitle: "Ingresa a tu cuenta" (white/70%)
- Inputs: semi-transparent bg (`bg-white/5 border-white/10 text-white placeholder:text-white/40`)
- Focus ring: `ring-white/30`
- Submit button: white bg, indigo text, full-width, font-semibold
- Link: "No tienes cuenta? Registrate" in white/70%
- Divider: "o" with `border-white/20` lines (for future OAuth)

### Register Card Content
- Same layout as login
- Fields: nombre, email, contrasena
- Same styling

### Mobile
- Same full-screen gradient, card takes more width
- Card padding slightly reduced

---

## 4. Sidebar (Dark)

- Background: `--sidebar` (#0F172A / slate-900)
- Width: 260px, sticky, full height
- Hidden on mobile (sheet/drawer for mobile)

### Logo Area
- "Turnly" in white, font-bold, text-xl
- Small calendar icon with gradient fill
- Padding: `px-6 py-5`

### Nav Items
- **Inactive**: text `slate-400`, icon `slate-500`, `px-3 py-2 rounded-lg`
- **Hover**: bg `white/5%`, text `slate-300`, transition 200ms
- **Active**: bg `white/10%`, text white, icon white, left border 3px gradient (indigo→violet)
- Items: Dashboard, Reservaciones, Registro de servicio, Clientes, Servicios, Equipo, Reportes
- Settings section separated by `border-t border-white/5`

### User Section (bottom)
- Avatar with gradient bg (indigo→violet) + initials
- User name (white, font-medium, truncated)
- Role (slate-400, text-xs)

---

## 5. TopBar

- Sticky, bg white, `backdrop-blur-xl`, `border-b border-slate-200/50`
- Height: `h-16`
- **Left**: Page title (text-lg, font-semibold, slate-900)
- **Right**: 
  - Search input (rounded-full, slate-100 bg, slate-400 placeholder, indigo focus ring)
  - Notification bell with red dot badge (pulse animation)
  - Avatar dropdown
- **Mobile**: Hamburger menu left, title center, avatar right

---

## 6. Dashboard Page

### Stat Cards (4-grid)
- White bg, card shadow (tinted indigo)
- Icon in circle with gradient bg (each card different: indigo, cyan, emerald, violet)
- Value: text-2xl, font-bold, slate-900
- Label: text-sm, slate-500
- Change indicator: small badge, green for positive (+arrow), red for negative (-arrow)
- Hover: translate-y -1px + deeper shadow

### Upcoming Reservations
- Card with table/list
- Rows with hover `bg-indigo-50/30`
- Each row: client avatar (gradient placeholder), name, service, time, status badge
- Status badges:
  - Pendiente: amber-100 bg, amber-700 text
  - Confirmada: cyan-100 bg, cyan-700 text
  - Completada: emerald-100 bg, emerald-700 text
  - Cancelada: red-100 bg, red-700 text

### Quick Actions
- Buttons with icon + label
- Border that shows gradient on hover
- Transition 200ms

---

## 7. Internal Pages

### Reservations
- Filter chips in row (Linear style):
  - Active: gradient indigo bg, white text, rounded-full
  - Inactive: slate-100 bg, slate-600 text, rounded-full
  - Hover inactive: slate-200
- FullCalendar re-themed:
  - `--fc-button-active-bg-color`: #6366F1
  - `--fc-today-bg-color`: indigo-50
  - Today number: indigo-500 bg circle
  - Event borders colored by status
- Create reservation dialog: modal with backdrop blur

### Clients
- Table with avatar gradient placeholders (initials)
- Row hover: `bg-indigo-50/30`
- Client detail: card with info + timeline history (vertical line with colored dots)

### Services
- Grid of cards per service
- Left border colored by category
- Icon/color indicator, name, duration, price
- Hover: elevation + shadow transition

### Team
- Grid of cards per member
- Large avatar, name, role
- Active status: green dot with `animate-pulse`
- Inactive: slate dot

### Reports
- Stat metric cards (same style as dashboard)
- Charts: indigo, violet, cyan, emerald color scheme
- Tables: slate-50 headers, subtle alternating rows

### Settings
- Sections in separate cards
- Clean inputs with indigo focus ring
- Toggle switches: indigo when active
- Save button: gradient, sticky bottom on mobile

---

## 8. Animations & Micro-interactions

- **Page transitions**: fade-in on mount (`animate-in fade-in duration-300`)
- **Cards hover**: `transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`
- **Buttons**: `transition-all duration-200`, slight scale on press (`active:scale-[0.98]`)
- **Sidebar items**: `transition-colors duration-200`
- **Hero gradient**: `@keyframes mesh { 0%,100% { background-position: 0% 50% } 50% { background-position: 100% 50% } }` — 15s infinite
- **Notification dot**: `animate-pulse`
- **Status dot (active team)**: `animate-pulse`
- **Modal backdrop**: `backdrop-blur-sm bg-black/50`, fade-in

---

## 9. Responsive Behavior

- **Sidebar**: hidden on mobile, accessible via Sheet drawer (hamburger in TopBar)
- **Stat cards**: horizontal scroll snap on mobile, 2-col on tablet, 4-col on desktop
- **Feature cards (landing)**: stack on mobile, 3-col on desktop
- **Auth card**: full-width with small margin on mobile, centered sm on desktop
- **Tables**: horizontal scroll on mobile, or card-list view
- **TopBar**: simplified on mobile (hamburger + title + avatar)
- **Dashboard mockup (hero)**: hidden or scaled down on mobile
