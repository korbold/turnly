# Customer App V2 — Design Spec

## Overview

New Flutter customer app from scratch with modern, visually striking UI/UX. Dynamic per-business theming, BLoC/Cubit state management, Clean Architecture. Connects to existing backend API (no backend changes).

## Architecture

```
lib/
├── app/
│   ├── app.dart
│   ├── router.dart
│   └── theme/
│       ├── app_theme.dart          # Neutral base theme
│       ├── tenant_theme.dart       # Dynamic per-business theme
│       └── typography.dart
├── core/
│   ├── network/                    # Dio client, interceptors (auth, tenant)
│   ├── storage/                    # Secure storage, Hive, SharedPrefs
│   ├── error/                      # Failure types
│   └── di/                         # get_it + injectable setup
├── features/
│   ├── auth/
│   │   ├── data/                   # AuthRepositoryImpl, DTOs
│   │   ├── domain/                 # User entity, AuthRepository interface
│   │   └── presentation/          # LoginCubit, RegisterCubit, screens
│   ├── explore/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/          # ExploreCubit, HomeScreen, search
│   ├── business/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/          # BusinessDetailCubit, detail screen
│   ├── reservations/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/          # ReservationsCubit, CreateReservationCubit, screens
│   ├── resources/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/          # ResourcesCubit, screens
│   ├── profile/
│   │   └── presentation/          # ProfileScreen (uses auth cubit)
│   ├── favorites/
│   │   ├── data/                   # Hive local storage
│   │   └── presentation/          # FavoritesCubit
│   ├── notifications/
│   │   └── presentation/          # UI-only, mock data
│   └── onboarding/
│       └── presentation/          # OnboardingScreen, slides
└── shared/
    ├── widgets/                    # Reusable UI components
    ├── extensions/                 # DateTime, String helpers
    └── constants/                  # API URLs, keys
```

**State management:** BLoC/Cubit per feature
**DI:** get_it + injectable
**Routing:** go_router with auth guards
**HTTP:** Dio with auth + tenant interceptors

## Screens & Flows

### Onboarding (first launch)
- 3 slides with illustrations, bold titles
- "Descubre negocios" → "Reserva en segundos" → "Tu historial siempre contigo"
- Button "Comenzar" → Login
- Flag stored in SharedPreferences

### Auth
- Login: email + password, clean design, logo top
- Register: name, email, password, optional phone
- Social login buttons (Google, Apple) — UI only, no functionality yet
- Animated fade transition between login ↔ register
- Inline validation

### Home (Tab 1)
- Header: "Hola, {name}" + avatar
- Rounded search bar
- "Próxima reserva" — highlighted card if upcoming booking exists
- "Favoritos" — horizontal scroll of saved businesses
- "Explorar" — grid/list of businesses with cover image, name, type, rating
- Category chips as horizontal filter

### Business Detail
- **Dynamic tenant theme applies here**
- Hero header: cover image with gradient overlay, name, type
- Tabs: Servicios / Info / Horarios
- Services as cards with price, duration, "Reservar" button
- Info: address, phone, description
- Hours: visual per day (open/closed)
- Floating "Reservar" FAB

### Create Reservation (3-step wizard)
- Step 1: Select resource (or create new)
- Step 2: Date (calendar picker) + time (slot chips)
- Step 3: Notes + custom fields + confirm
- Animated progress bar top
- Maintains business theme

### Reservations (Tab 2)
- Tabs: Próximas / Completadas / Canceladas
- Cards: business name, service, date/time, colored status badge
- Pull-to-refresh
- Empty state with illustration

### Reservation Detail
- Large card with full info
- Prominent status with color
- Cancel button (if within cancellation_hours)
- Business info summary

### Profile (Tab 3)
- Avatar + name + email
- Sections: Mis Registros, Notificaciones, Favoritos, Ayuda, Cerrar sesión
- Each section as row with icon and chevron

### Favorites
- List of saved businesses (Hive local persistence)
- Heart toggle from any business card

### Notifications
- List with icon + title + date
- UI ready, mock data for now

## Navigation

Bottom nav with 3 tabs:
1. **Home** — explore, search, favorites, next reservation
2. **Reservas** — reservation list with status filters
3. **Perfil** — user info, settings, resources, logout

## Dynamic Theme System

### Base theme (neutral — used in Home, Reservas, Perfil)
- Background: `#F8F9FB`
- Surface: `#FFFFFF`
- Text primary: `#1A1D26`
- Text secondary: `#6B7280`
- Typography: Inter or Poppins (bold titles, regular body)
- Border radius: 16px cards, 12px inputs, 24px buttons

### Default palettes by business type

| Type | Primary | Secondary | Accent |
|------|---------|-----------|--------|
| car_wash | `#0EA5E9` | `#E0F2FE` | `#0284C7` |
| barbershop | `#1E293B` | `#F1F5F9` | `#F59E0B` |
| spa | `#A78BFA` | `#EDE9FE` | `#7C3AED` |
| gym | `#10B981` | `#D1FAE5` | `#059669` |
| medical | `#06B6D4` | `#CFFAFE` | `#0891B2` |
| default | `#6366F1` | `#EEF2FF` | `#4F46E5` |

### How it works
1. Backend returns `business_type` (future: custom colors from admin "Marca" tab)
2. `TenantThemeCubit` generates `TenantTheme` from type
3. Business detail + reservation screens read from cubit
4. Global screens always use base theme
5. Smooth transition with `AnimatedTheme`

### Elements that change with tenant theme
- App bar color
- Primary buttons
- Service cards border/accent
- Wizard progress bar
- Selected slot chips
- FAB

## Shared Widgets

| Widget | Purpose |
|--------|---------|
| `AppTextField` | Styled input with label, error, soft borders |
| `AppButton` | Primary/secondary/outline, loading state, 24px radius |
| `BusinessCard` | Business: image, name, type badge, favorite toggle |
| `ServiceCard` | Service: name, price, duration, book button |
| `ReservationCard` | Reservation: business, service, date, status badge |
| `StatusBadge` | Colored chip per status |
| `SectionHeader` | Title + "Ver todo" link |
| `EmptyState` | Icon + text + optional action button |
| `ShimmerLoader` | Skeleton loading for cards and lists |
| `AvatarCircle` | User avatar with initials fallback |
| `StepIndicator` | Animated progress bar for wizard |
| `SlotChip` | Selectable chip for time slots |
| `CategoryChip` | Category filter with icon and color |
| `HeroHeader` | Image with gradient overlay for business detail |

### Visual principles
- Soft shadows (blur: 20, opacity: 0.08)
- Generous spacing (16-24px between sections)
- Consistent rounded corners (16px cards, 24px buttons)
- Micro-animations with flutter_animate on screen transitions
- Custom pull-to-refresh indicator

## Data Flow

```
Screen → Cubit → Repository (interface) → Repository (impl) → Dio → API
                                                                  ↓
Screen ← Cubit ← Either<Failure, Entity> ←←←←←←←←←←←←←←←←←←←←←←
```

### Cubit state pattern
```
Initial → Loading → Loaded(data) | Error(message)
```

### Failure types
- `NetworkFailure` — no connection
- `ServerFailure(message, code)` — backend error
- `AuthFailure` — 401, redirect to login
- `CacheFailure` — local storage error

### Error handling in UI
- No internet: banner top "Sin conexión" + retry
- Server error: snackbar with message + retry in empty state
- 401: auto-logout, clear tokens, redirect to login
- Loading: shimmer skeletons (no generic spinners)

### Cache strategy
- Favorites: Hive local, no backend
- Onboarding seen: SharedPreferences bool
- Token: flutter_secure_storage
- Businesses/reservations: no local cache, always fresh from API

## Dependencies

```yaml
# Core
flutter_bloc: ^9.0.0
get_it: ^8.0.0
injectable: ^2.5.0
go_router: ^14.8.0
dio: ^5.7.0
equatable: ^2.0.7

# Storage
flutter_secure_storage: ^9.2.0
hive_flutter: ^1.1.0
shared_preferences: ^2.3.0

# UI
cached_network_image: ^3.4.0
shimmer: ^3.0.0
flutter_animate: ^4.5.0
smooth_page_indicator: ^1.2.0
intl: ^0.19.0

# Functional
fpdart: ^1.1.0

# Dev
injectable_generator: ^2.6.0
build_runner: ^2.4.0
flutter_lints: ^5.0.0
```

## Backend API (no changes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | POST | Login |
| `/auth/register` | POST | Register |
| `/auth/logout` | POST | Logout |
| `/auth/me` | GET | Current user |
| `/public/tenants` | GET | List businesses |
| `/public/tenants/{slug}` | GET | Business detail + services |
| `/client/reservations` | GET | User reservations |
| `/client/reservations/{id}` | GET | Reservation detail |
| `/reservations` | POST | Create reservation |
| `/reservations/available-slots` | GET | Available time slots |
| `/client/reservations/{id}/cancel` | PATCH | Cancel reservation |
| `/client-resources` | GET/POST | Get/create client resources |
| `/client-resources/{id}/history` | GET | Resource service history |

**Auth:** Bearer token in Authorization header
**Multi-tenancy:** X-Tenant header with business slug
**Base URL:** configurable via environment

## Project Location

New project at: `apps/customer_v2/`
