# Admin V2 — Full Redesign Spec

## Overview

Rewrite the Turnly admin panel from scratch. Same business logic, same backend API, new architecture (Clean Architecture), modern SaaS UI/UX designed for non-technical business owners (car washes, barbershops, spas, gyms).

**Approach:** Full rewrite in `apps/admin-v2/`. Backend unchanged — only frontend.

---

## Tech Stack

### Keep
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- shadcn/ui
- Tailwind CSS 4
- TanStack React Query 5
- React Hook Form + Zod
- Axios

### Add
- **Framer Motion** — page transitions, micro-interactions
- **Recharts** — dashboard and report charts
- **nuqs** — URL state management for filters, date ranges, pagination

### Remove
- **FullCalendar** — replace with custom timeline + lightweight calendar component
- **jspdf / jspdf-autotable** — keep for PDF export but evaluate lighter alternatives

---

## Architecture — Clean Architecture (Frontend)

### Layer Diagram

```
UI Component → Hook → Use Case → Repository Interface → API Repository → Backend
     ↑                                                          |
     └──────────── Mapper (API response → Domain entity) ←──────┘
```

**Dependency rule:** arrows always point inward (Presentation → Application → Domain ← Infrastructure).

### Folder Structure

```
apps/admin-v2/
├── src/
│   ├── domain/                     # Zero external dependencies
│   │   ├── entities/               # Pure business types
│   │   │   ├── reservation.ts
│   │   │   ├── service.ts
│   │   │   ├── client-resource.ts
│   │   │   ├── service-log.ts
│   │   │   ├── user.ts
│   │   │   ├── tenant.ts
│   │   │   └── availability.ts
│   │   ├── repositories/           # Interface contracts
│   │   │   ├── reservation.repository.ts
│   │   │   ├── service.repository.ts
│   │   │   ├── client-resource.repository.ts
│   │   │   ├── service-log.repository.ts
│   │   │   ├── user.repository.ts
│   │   │   ├── tenant.repository.ts
│   │   │   └── auth.repository.ts
│   │   └── value-objects/
│   │       ├── money.ts
│   │       ├── time-slot.ts
│   │       └── date-range.ts
│   │
│   ├── application/                # Use cases
│   │   ├── use-cases/
│   │   │   ├── reservations/
│   │   │   ├── services/
│   │   │   ├── service-logs/
│   │   │   ├── clients/
│   │   │   ├── team/
│   │   │   ├── reports/
│   │   │   ├── settings/
│   │   │   └── auth/
│   │   └── dto/
│   │
│   ├── infrastructure/             # Concrete implementations
│   │   ├── api/
│   │   │   ├── client.ts           # Axios instance + interceptors
│   │   │   ├── repositories/       # API implementations of domain contracts
│   │   │   └── mappers/            # API response → Domain entity
│   │   ├── storage/
│   │   │   └── auth-storage.ts     # localStorage wrapper
│   │   └── providers/
│   │       └── repository.provider.tsx  # Dependency injection via React Context
│   │
│   ├── presentation/               # UI layer
│   │   ├── app/                    # Next.js App Router routes
│   │   │   ├── (auth)/
│   │   │   ├── (onboarding)/
│   │   │   ├── (tenant)/
│   │   │   ├── (super-admin)/
│   │   │   └── (public)/
│   │   ├── components/
│   │   │   ├── ui/                 # Design system primitives (shadcn customized)
│   │   │   ├── layout/             # Shell, sidebar, bottom-tabs, topbar
│   │   │   └── features/           # Domain-specific components
│   │   │       ├── dashboard/
│   │   │       ├── reservations/
│   │   │       ├── services/
│   │   │       ├── clients/
│   │   │       ├── team/
│   │   │       ├── reports/
│   │   │       ├── settings/
│   │   │       └── onboarding/
│   │   ├── hooks/                  # React hooks (consume use-cases)
│   │   └── styles/
│   │       └── globals.css
│   │
│   └── shared/                     # Cross-layer utilities
│       ├── constants/
│       ├── utils/
│       └── types/                  # Helper types (ApiResponse, PaginatedResult, etc.)
```

### Example Flow

```ts
// domain/repositories/reservation.repository.ts
export interface ReservationRepository {
  getAll(filters: ReservationFilters): Promise<PaginatedResult<Reservation>>
  getById(id: string): Promise<Reservation>
  create(data: CreateReservationDTO): Promise<Reservation>
  cancel(id: string, reason: string): Promise<Reservation>
  transition(id: string, action: ReservationAction): Promise<Reservation>
}

// application/use-cases/reservations/get-reservations.ts
export class GetReservationsUseCase {
  constructor(private repo: ReservationRepository) {}
  execute(filters: ReservationFilters) {
    return this.repo.getAll(filters)
  }
}

// presentation/hooks/use-reservations.ts
export function useReservations(filters: ReservationFilters) {
  const repo = useRepository<ReservationRepository>('reservation')
  const useCase = new GetReservationsUseCase(repo)
  return useQuery({
    queryKey: ['reservations', filters],
    queryFn: () => useCase.execute(filters)
  })
}
```

---

## Design System

### Color Palette (App Chrome)

| Token | Value | Usage |
|-------|-------|-------|
| Primary | Indigo-600 `#4F46E5` | Buttons, links, accents |
| Background | Slate-50 `#F8FAFC` | General background |
| Card | White + Slate-200 border | Cards, panels |
| Text Primary | Slate-900 | Headings |
| Text Secondary | Slate-600 | Body text |
| Text Muted | Slate-400 | Placeholders |
| Success | Emerald-500 | Positive states |
| Error | Rose-500 | Errors, destructive |
| Warning | Amber-500 | Warnings, pending |
| Info | Sky-500 | Informational |

### Reservation Status Colors

| Status | Color | Badge |
|--------|-------|-------|
| Pendiente | Amber | Yellow/orange |
| Confirmada | Sky | Light blue |
| En progreso | Indigo | Purple-blue |
| Completada | Emerald | Green |
| Cancelada | Rose | Red |
| No-show | Slate | Gray |

### Typography

- **Font:** Inter (more legible than Geist for non-tech users)
- **Headings:** Semibold
- **Body:** Regular
- **Labels:** Medium
- **Scale:** 12px small, 14px base, 16px subtitle, 20px heading, 28px page title

### Spacing & Layout

- 12-column grid desktop, 4-column mobile
- Cards: 24px padding desktop, 16px mobile
- Section gap: 24px
- Border radius: 12px cards, 8px inputs, 20px large buttons

### Micro-interactions (Framer Motion)

- Page transitions: fade + subtle slide (150ms)
- Cards: hover scale 1.01 + shadow elevation
- Buttons: press scale 0.97
- Toasts: slide from top
- Skeleton loaders on all data fetches

### Tenant Brand Palettes

12-15 curated palettes. No free color picker. Each palette defines primary, primary-hover, primary-muted, accent. Tenants select one in Settings > Brand.

---

## Navigation & Layout

### Desktop (>=1024px)

- **Sidebar:** 240px expanded, 64px collapsed (icons only)
- Toggle collapse with button, auto-collapse on tablet
- Logo + tenant name at top
- Nav items with icon + label + badge counter
- Order: Dashboard, Reservaciones, Registro Diario, Clientes, Servicios, Equipo, Reportes
- Settings + profile at bottom, separated
- Active item: soft primary background + left accent border

### Mobile (<768px)

- **Bottom tab bar:** 5 items max
  - Dashboard, Reservaciones, **+ (FAB central)**, Reportes, Más
- FAB "+" opens bottom sheet: Nueva Reserva, Walk-in, Bloquear Horario
- "Más" opens bottom sheet: Clientes, Servicios, Equipo, Settings
- **Topbar:** Logo left, notification bell + avatar right
- No hamburger menu — bottom tabs always visible

### Tablet (768-1024px)

- Sidebar collapsed permanently (icons only, 64px)
- Hover tooltip shows section name

### Topbar

- **Left:** Contextual breadcrumb
- **Center:** Search bar (Cmd+K) — searches clients, reservations, services
- **Right:** Notification bell (badge) + Avatar dropdown (profile, switch business, logout)

---

## Pages

### Dashboard

**Widgets (priority order):**

1. **Live Service Tracker** (main widget)
   - Cards: client resource, service, employee, elapsed time counter
   - Progress bar only if service has configured duration — otherwise just timer (⏱ 23min)
   - Red if overtime (only when duration exists)
   - "Complete" button inline
   - Empty state: illustration + "No services in progress" + start button

2. **Revenue Cards** — Today, Week, Month
   - Large amount + % vs previous period with ↑↓ arrow
   - Green positive, red negative
   - Click opens reports with matching range

3. **Quick Actions** — 3 large buttons
   - New Reservation, Walk-in, Block Time
   - Open respective modal/sheet
   - On mobile: moved to FAB central

4. **Upcoming Reservations** — next 3-5 confirmed
   - Time + client name + service
   - "in X min" badge if within 30min
   - Click navigates to detail

5. **Alerts** — topbar badge, not dashboard widget
   - New reservations → bell badge
   - Cancellations → toast notification
   - No-shows → alert when time passes without check-in

**Greeting:** "Buenos días, {name}" + business name + today's date

**Mobile:** Stack vertical. Revenue cards = horizontal scroll. Live tracker = full width cards.

### Reservations

**Primary view: Timeline**

- Vertical axis = hours of day
- Cards positioned by scheduled time
- Left border color = status
- Card: client name, service, resource, employee, duration
- Click card → slide-over panel right with full detail + actions
- Red horizontal "now" line moving in real time
- Visible gaps = clear availability

**Filters:**

- Quick tabs: All, Pending, Confirmed, In Progress, Completed (with counts)
- Extra filters dropdown: service, employee, date
- Date selector: Today (default), tomorrow, calendar picker
- Filters persist in URL (nuqs)

**Detail Panel (slide-over right):**

- Status badge + contextual action buttons:
  - Pending → Confirm / Cancel
  - Confirmed → Start / Cancel / No-show
  - In progress → Complete
- Cancel always requires reason input
- Client info, resource info, service, time, employee, notes
- History log (created, by whom)

**Secondary view: Custom Calendar**

- Lightweight custom component (no FullCalendar)
- Week view default, toggle to month
- Color dots per status in cells
- Click cell → shows day's reservation list
- For planning, not daily operations

**Create Reservation (modal, 4 steps):**

1. Select service (visual cards)
2. Choose date + available slot (time grid)
3. Existing client or new + resource
4. Assign employee (optional) + notes
5. Confirm → close modal, success toast, update timeline

**Mobile:**

- Timeline vertical full width
- Simplified cards: name + service + time + status badge
- Tap card → full screen detail (no slide panel)
- Swipe card left = quick action (confirm/cancel per status)
- Filter tabs = horizontal scroll
- No calendar view on mobile

### Service Log (Daily Registry)

**Summary cards (top):** Total services today, revenue, breakdown by payment method. Real-time update.

**Service list:**

- Reverse chronological (newest first)
- Each row: time, client resource, service, employee, price, payment method, status
- In progress → inline "Complete" button
- Menu [...]: Edit, Delete
- Status: In progress (indigo), Completed (emerald)

**New Service form (modal):**

- Service as selectable cards (not dropdown) — price auto-fills
- Client search with autocomplete — create inline if new
- Editable price (override for special pricing)
- Payment method: Cash, Card, Transfer, Other
- Employee: dropdown of active staff

**Day navigation:**

- Date selector top — tap opens calendar
- Swipe horizontal between days (mobile)
- Arrows ← → (desktop)

**Mobile:** Summary cards = horizontal scroll. List = full width cards. FAB "+" opens full screen form.

### Clients (Client Resources)

**List view:**

- Cards adaptive to tenant custom fields
  - Car wash: plate prominent + brand/model/color + owner
  - Barbershop/spa: person name prominent + phone
- Meta always: last service (timeago) + total visits
- Star badge for frequent clients (>10 visits)
- Search bar with 300ms debounce, searches all fields
- Click → detail page

**Detail page:**

- Full client/resource info with all custom fields
- Stats: total visits, total spent, last visit
- History tabs: Services (logs) | Reservations
- Reverse chronological

**Create/Edit (modal):**

- Dynamic fields based on tenant custom fields
- User search (if client has account)
- Real-time validation
- Base fields + auto-rendered custom fields by type

**Mobile:** Full width cards, sticky search, detail = full screen.

### Services

- Grid of cards with image, name, price, duration (optional), status
- Toggle active/inactive directly on card
- Menu [...]: Edit, Delete
- Drag & drop to reorder (sort_order)
- Create/edit modal: name, price, description, image upload, duration (optional), active toggle
- Mobile: 2-column grid

### Team (Staff)

- List of cards: avatar, name, email, phone, role badge
- Change role = inline dropdown (tenant_admin, cashier, washer, client)
- Invite = modal with email + role
- Mobile: full width list

### Reports

**Range presets:** Today, This Week, This Month, Last Month, Custom (date range picker)

**Stats cards:** Total services, revenue, reservations, daily average revenue

**Charts:**
- Revenue area chart by day (Recharts)
- Payment method donut chart with absolute amounts + percentages:
  - Cash: $810k (45%)
  - Card: $684k (38%)
  - Transfer: $306k (17%)
  - Total: $1,800,000

**Daily breakdown table:**

| Date | Services | Revenue | Cash | Card | Transfer | Reservations |
|------|----------|---------|------|------|----------|-------------|
| 16/04 | 8 | $280k | $130k | $100k | $50k | 4 |

- Click row → day detail with all logs and reservations
- PDF export
- Range persists in URL (nuqs)
- Mobile: charts stack vertical, table horizontal scroll, presets as horizontal scroll chips

### Settings

**Layout:** Side tabs desktop, top chips mobile. 6 tabs:

1. **General** — Logo, cover, name, type, description, address, phone, slug (read-only), slot duration, cancellation hours, social links (Instagram, Facebook, WhatsApp)

2. **Schedule** — Weekly hours per day with toggle active/closed, multiple time ranges per day, add range button. Availability blocks list: date, reason, all-day or time range. Create + delete.

3. **Gallery** — Image grid, drag & drop reorder, multi-upload (max 10), preview + delete. Counter "X/10 photos".

4. **Custom Fields** — Drag & drop list of fields. Each: name, type (text/number/select/textarea), required toggle. Select type → inline editable options. Menu [...]: Edit, Delete.

5. **Permissions** — Visual matrix: roles × sections. 3 states per cell: Full (✅), View-only (👁️), None (─). Click cycles states. Auto-save with debounce.

6. **Brand** — 12-15 curated palettes in visual grid. Click to select with live preview of sidebar/buttons. Active palette with checkmark.

### Auth — Login

- Centered card, subtle gradient background
- Email + password only
- Link to register

### Onboarding — Registration (Minimal)

- 4 fields: business name, your name, email, password
- Slug auto-generated from business name
- Business type, phone, city → asked contextually inside app later
- Submit → straight to dashboard with onboarding banners

### Onboarding — Contextual (Post-Registration)

- Banner at top of dashboard, collapsible
- Visual progress bar (X of 6 steps)
- Steps: Create account ✅, Business name ✅, First service, Configure schedule, Upload logo, First reservation
- Each step links directly to relevant section
- "Skip for now" hides banner; reappears as subtle sidebar item until complete
- Business type asked as first contextual prompt (soft modal, non-blocking)

### Public Page (`/[slug]`)

- Tenant brand palette colors
- Gallery carousel
- Business info: description, address, phone
- Services as cards with "Reserve" button
- Inline booking flow: service → date → slot → customer data (custom fields) → confirm
- Slots calculated from schedule + blocks + service duration
- No login required to book
- Social links footer
- Mobile: natural vertical stack

### Super Admin

Visual redesign only, no functional changes:

- **Dashboard:** 4 stat cards (tenants, active, users, total reservations) + new registrations trend chart (weekly)
- **Tenants:** Table with search + filters (status, plan). Actions: suspend, activate, enter as tenant
- **Users:** Table with search. Basic info + associated tenant

---

## API Endpoints (Unchanged)

All existing backend endpoints remain the same. Frontend connects to:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `POST /onboarding/register`, `POST /onboarding/verify`, `GET /onboarding/check-slug`, `POST /onboarding/business-type`
- `GET/PATCH /tenant/settings`, `GET/POST/DELETE /tenant/images`
- `GET/POST /reservations`, `GET /reservations/{id}`, `PATCH /reservations/{id}/{action}`, `GET /reservations/available-slots`
- `GET/POST /service-logs`, `GET/PATCH/DELETE /service-logs/{id}`, `GET /service-logs/summary`
- `GET/POST /client-resources`, `GET/PATCH /client-resources/{id}`, `GET /client-resources/{id}/history`
- `GET/POST /services`, `PUT/DELETE /services/{id}`
- `GET /users`, `POST /users/invite`, `GET /users/{id}`, `PATCH /users/{id}/role`
- `GET /reports/daily`, `GET /reports/range`, `GET /reports/weekly`, `GET /reports/monthly`
- `POST /uploads`
- `GET/PUT /availability-slots`, `GET/POST/DELETE /availability-blocks`
- `GET /superadmin/stats`, `GET /superadmin/tenants`, `PATCH /superadmin/tenants/{id}/{action}`, `GET /superadmin/users`
- `GET /v1/public/tenants`, `GET /v1/public/tenants/{slug}`, `GET /v1/public/tenants/{slug}/available-slots`, `POST /v1/public/tenants/{slug}/book`

---

## Authentication

- Bearer token via Sanctum (stored in localStorage)
- Headers: `Authorization: Bearer {token}`, `X-Tenant: {slug}`
- 401 → redirect to /login
- localStorage keys: `auth_token`, `tenant_slug`, `is_super_admin`, `super_admin_mode`

---

## Non-Goals (V1)

- Dark mode
- Free color picker for tenants
- Mobile native app
- Real-time WebSocket updates (polling is fine for V1)
- Multi-language / i18n
- Offline support
- FullCalendar dependency
