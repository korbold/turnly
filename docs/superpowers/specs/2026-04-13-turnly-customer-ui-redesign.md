# Turnly Customer App — UI Redesign Spec

**Date:** 2026-04-13
**Approach:** Clean & Bold
**Scope:** Full redesign of all 12 screens in the Flutter customer app

---

## 1. Design System (Theme)

### Colors

Palette stays the same with adjustments:

| Token | Value | Notes |
|-------|-------|-------|
| primary | #396AFF | Unchanged |
| darkText | #343C6A | Unchanged |
| bodyText | #718EBF | Unchanged |
| background | #F5F7FA | Unchanged |
| surface | #FFFFFF | Unchanged |
| surfaceVariant | #F0F4FF | **NEW** — section backgrounds, price containers |
| border | #DFE5EE | Unchanged |
| inputFill | removed | Inputs use white fill instead |
| activeNav | removed | Unified with primary |
| accent | #E7EDFF | Unchanged |
| success | #41D4A8 | Unchanged |
| warning | #FFBB38 | Unchanged |
| error | #FF4B4A | Unchanged |

**Category colors** (for business type icon backgrounds):

| Category | Background | Icon Color |
|----------|-----------|------------|
| car_wash | #DBEAFE | #2563EB |
| barbershop | #FFEDD5 | #EA580C |
| spa | #D1FAE5 | #059669 |
| gym | #FEE2E2 | #DC2626 |
| medical | #EDE9FE | #7C3AED |
| default | #E7EDFF | #396AFF |

### Cards

- Elevation: 0 (no Material elevation)
- Shadow: `BoxShadow(color: Color(0x14000000), blurRadius: 20, offset: Offset(0, 4))`
- Border: none (remove 0.5px border)
- Border radius: 20px (up from 16)
- Background: white

### AppBar

- Background: transparent (shows scaffold background)
- Title: left-aligned, 22px, bold 700
- No border, no elevation

### Bottom Navigation Bar

- Floating style: horizontal margin 20px, bottom margin 12px
- Border radius: 24px
- Background: white
- Shadow same as cards
- Height: 64px
- Selected: primary color icon + label
- Unselected: bodyText color
- No indicator background — just color change

### Buttons

- ElevatedButton: 54px height, radius 14, primary bg, subtle shadow `BoxShadow(color: primary.withOpacity(0.25), blurRadius: 12, offset: Offset(0, 4))`
- OutlinedButton: 54px height, radius 14, border color border
- TextButton: primary color, 500 weight

### Inputs

- Fill color: white (not grey)
- Border: 1px border color
- Focus: primary border + subtle blue shadow `BoxShadow(color: primary.withOpacity(0.1), blurRadius: 8)`
- Border radius: 14px
- Content padding: horizontal 16, vertical 16

### Spacing Scale

8, 12, 16, 24, 32 — use consistently.

---

## 2. Explorar (Home Tab)

### Header (replaces AppBar)

- Custom header, no standard AppBar
- Left: "Hola, {name}" (titleLarge bold) + line below: "Que servicio buscas hoy?" (bodyMedium, bodyText color)
- Right: CircleAvatar 40px with user initials (primary bg, white text)
- Padding: horizontal 20, top: MediaQuery.padding.top + 16

### Search Bar

- White card with shadow (same as card style)
- Search icon left, hint "Buscar negocios..."
- Clear button when text present
- Border radius 16px
- Padding horizontal 20, vertical 12

### Category Chips

- Horizontal scrollable row below search
- Padding: horizontal 20, spacing 8
- Items: "Todos", "Car Wash", "Barberia", "Spa", "Gym", "Clinica"
- Active chip: primary bg, white text, radius 12, padding h:16 v:8
- Inactive chip: surface bg, darkText, radius 12, border subtle
- Tapping filters the business list by `business_type`
- "Todos" clears the filter

### Business Cards

- Card with shadow (new card style)
- Padding: 20px
- Left: icon container 56x56, radius 16, category-colored background + icon
- Center: business name (16px, bold 600), type as small chip (fontSize 11, category color bg, rounded), description (max 2 lines), address row with location icon
- Right: chevron_right icon
- Bottom right corner: "Nuevo" text with star icon (placeholder for future ratings)
- Spacing between cards: 12px

### Empty State

- Icon: store_outlined 72px, bodyText color
- Title: "No hay negocios cerca" (16px, bold)
- Subtitle: "Intenta con otra busqueda" (14px, bodyText)

---

## 3. Detalle de Negocio

### Hero Header

- No standard AppBar — custom with back button overlay
- Gradient background: category color at 15% opacity → transparent (height ~200px)
- Centered icon container: 80x80, radius 24, category color bg + icon (36px)
- Business name: 22px bold, centered
- Type chip below name: category bg + text
- Address with location icon, centered
- Phone icon button + share icon button in a row (if phone exists)

### Services Section

- Section title: "Servicios (N)" — left aligned, 18px bold
- Service cards:
  - Row layout: left side has name (15px bold) + description (13px, bodyText, max 2 lines) + duration if available (clock icon + text)
  - Right side: price in surfaceVariant container (rounded, padding 8x12) + "Reservar" pill button (primary bg, white text, radius 20, compact)
  - Divider between services (0.5px, border color)

### Availability Section

- Collapsible with ExpansionTile or custom toggle
- Title: "Horarios" with chevron icon
- Collapsed by default
- Each row: day name left (bold if today) + hours right
- Today's row: green dot if currently open, red dot if closed
- Compact: all 7 days visible without much vertical space

---

## 4. Crear Reservacion

### Step Indicator

- Horizontal row at top: 3 circles connected by lines
- Labels: "Fecha", "Horario", "Confirmar"
- Active step: primary bg circle with white number
- Completed step: primary bg with check icon
- Upcoming: border-only circle with grey number
- Visual only — not interactive, just shows progress as user scrolls

### Date Selector

- Horizontal scrollable row of next 7 days
- Each item: column with day abbreviation (Lun, Mar...) on top + day number below
- Selected: primary circle bg, white text
- Today: small dot indicator below the number
- Disabled (no slots): grey text, no tap
- Container: white card with shadow, padding 16, border radius 16
- Replaces the OutlinedButton that opens native DatePicker
- "Ver mas" button at end to open native DatePicker for dates beyond 7 days

### Time Slots

- Grouped by time of day:
  - "Manana" (before 12:00)
  - "Tarde" (12:00+)
- Each group: subtitle text (14px, bold) + grid
- Grid: 3 columns (instead of 4)
- Slot styles:
  - Available: white bg, subtle border, darkText
  - Occupied: #F5F5F5 bg, bodyText color, no tap
  - Selected: primary bg, white text, shadow
- Legend: compact row with colored dots + labels (not squares)

### Vehicle/Resource Section

- Radio-style cards for existing resources
- Selected: primary border (2px) + accent bg + check icon
- Unselected: border color, surface bg
- "Registrar nuevo" option opens a BottomSheet (not inline form)
- BottomSheet contains the custom field form with "Guardar" button

### Summary & Submit

- Sticky bottom container (above safe area)
- Card showing: service name + date + time + resource (single line each, compact)
- "Confirmar reservacion" button full-width below the summary
- Card only appears once a slot is selected

---

## 5. Mis Citas (Reservations Tab)

### Status Filter

- Horizontal chip row at top (below AppBar)
- Chips: "Proximas", "Completadas", "Canceladas"
- "Proximas" = pending + confirmed + in_progress
- "Completadas" = completed
- "Canceladas" = cancelled + no_show
- Active chip: primary bg, white text
- Inactive: surface bg, darkText
- Replaces the hidden popup menu

### Next Appointment Card

- First card is highlighted: primary border (1.5px), slightly larger padding
- Label "Proxima cita" above it in small text

### Reservation Cards Redesigned

- Date prominent: day number large (24px bold) + month abbreviation + year if not current
- Time to the right of date
- Business name + service name
- Resource label if exists
- Status badge top-right
- Section separators: "Hoy", "Esta semana", "Mas adelante" (for Proximas tab)

### Empty State

- Calendar icon 72px
- "No tenes citas proximas"
- "Explorar negocios" button (outlined) — navigates to Explorar tab

### Remove FAB

- No floating action button — reservations start from business detail screen

---

## 6. Detalle de Reservacion

### Status Header

- Full-width container at top with status color background (at 10% opacity)
- Status icon centered (check for confirmed, clock for pending, play for in_progress, x for cancelled)
- Status label bold below icon
- Height: ~100px

### Info Sections

Organized in labeled groups with clear spacing:

- **Cuando:** "Lun 14 Abr, 10:00 - 10:30" — large text (16px bold), calendar icon
- **Donde:** Business name (bold) + address (bodyText), store icon. Tap opens map (url_launcher)
- **Servicio:** Service name + price in surfaceVariant pill, build icon
- **Recurso:** Resource label with car icon (only if exists)
- **Atendido por:** Staff name (only if assigned)
- **Notas:** Note text in italic (only if exists)

Each section: icon left (in 40x40 colored container) + content right. Consistent vertical spacing 16px.

### Actions Footer

- Sticky bottom container
- If cancellable: "Cancelar cita" outlined button, error color border + text
- Cancellation policy text (12px, bodyText) below button: "Puedes cancelar hasta X horas antes"
- Cancel flow: BottomSheet with reason text field + "Confirmar cancelacion" button

---

## 7. Auth Screens

### Login

- Top-aligned layout (not vertically centered)
- Padding top: 80px
- "Turnly" text: 28px, bold 800, primary color
- Tagline: "Reserva en segundos" — 14px, bodyText
- Spacing: 40px after tagline
- Email field with floating label + mail icon
- Password field with floating label + lock icon + visibility toggle
- Spacing: 24px between fields
- Error banner: error color bg at 8%, error icon + message text
- "Iniciar sesion" primary button
- Divider with "o" text centered (for future social login)
- "Crear cuenta" outlined button full-width
- Bottom padding safe area

### Register

- Same top-aligned layout
- Title: "Crear cuenta" 28px bold
- Fields: name, email, phone (optional label), password
- Password strength bar below password field (4 segments: red/orange/yellow/green)
- "Crear cuenta" primary button
- "Ya tenes cuenta? Inicia sesion" text button at bottom

---

## 8. Perfil

### Header

- CircleAvatar 72px: primary bg, user initials in white (20px bold)
- Name: 20px bold, centered below avatar
- Email: 14px bodyText, centered
- "Editar perfil" text button (for future — navigate nowhere, just present)
- Spacing: 32px after header

### Options List

- Each option: card (new card style) with padding 16
- Left: icon in 40x40 container with category-style coloring
  - "Mis vehiculos": blue bg, directions_car icon
  - "Notificaciones": orange bg, notifications icon (disabled/future)
  - "Ayuda": green bg, help_outline icon (disabled/future)
- Center: option title (15px, 600 weight)
- Right: chevron_right
- Spacing: 12px between cards

### Logout

- TextButton at bottom: "Cerrar sesion", error color text
- No prominent button — just text
- Padding bottom: 32px

---

## 9. Recursos del Cliente

### List Screen

- AppBar: "Mis Recursos" left-aligned (new AppBar style)
- Cards:
  - Icon left (directions_car in blue container 44x44)
  - Resource data: primary label bold + secondary data below
  - Chip: "Ultimo servicio: hace 3 dias" (if history exists) — bodyText, small
  - Swipe left to delete with red background + trash icon + confirmation dialog
- FAB: add icon, primary color — kept because adding resources makes sense from this screen
- Empty state: car icon + "No tenes recursos registrados" + "Agregar" button

### History Screen

- AppBar: "Historial - {label}"
- Timeline layout:
  - Vertical line (2px, border color) on the left, 24px from edge
  - Each entry: colored dot on the line (green=completed, red=cancelled, blue=in_progress)
  - Right of dot: card with service name + date/time + payment method + price
  - Price aligned right in surfaceVariant pill
- Compact: no full cards, just rows with timeline connector

---

## Technical Notes

### Files to Modify

1. `lib/core/theme/app_theme.dart` — full rewrite of theme + AppColors
2. `lib/features/home/presentation/screens/home_screen.dart` — Explore tab + bottom nav redesign
3. `lib/features/home/presentation/screens/business_detail_screen.dart` — hero header + collapsible hours
4. `lib/features/home/presentation/screens/profile_screen.dart` — new layout with user info
5. `lib/features/reservations/presentation/screens/create_reservation_screen.dart` — stepper + date row + grouped slots + sticky summary
6. `lib/features/reservations/presentation/screens/reservations_screen.dart` — chip filters + card redesign
7. `lib/features/reservations/presentation/screens/reservation_detail_screen.dart` — status header + info sections + sticky footer
8. `lib/features/reservations/presentation/widgets/reservation_card.dart` — new card layout
9. `lib/features/reservations/presentation/widgets/slot_picker.dart` — 3-col grid + grouping
10. `lib/features/reservations/presentation/widgets/status_badge.dart` — minor style update
11. `lib/features/auth/presentation/screens/login_screen.dart` — top-aligned + typography
12. `lib/features/auth/presentation/screens/register_screen.dart` — matching style + password strength
13. `lib/features/client_resources/presentation/screens/client_resources_screen.dart` — swipe delete + chip
14. `lib/features/client_resources/presentation/screens/client_resource_history_screen.dart` — timeline layout

### New Widgets to Create

- `lib/shared/widgets/category_chip.dart` — reusable category filter chip
- `lib/shared/widgets/section_title.dart` — consistent section headers
- `lib/shared/widgets/floating_bottom_bar.dart` — reusable floating bottom nav container
- `lib/shared/widgets/date_selector.dart` — horizontal date picker (7 days)
- `lib/shared/widgets/step_indicator.dart` — 3-step visual progress
- `lib/core/theme/category_colors.dart` — category color mapping helper

### No Backend Changes Required

All changes are frontend-only. The API responses already contain all needed data (business_type, user name, etc.).

### Existing Behavior Preserved

- All navigation routes unchanged
- All API calls unchanged
- All business logic unchanged
- Only visual presentation changes
