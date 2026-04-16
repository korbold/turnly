# Admin Mobile — Flutter App Spec

## Overview

Native mobile app (iOS + Android) mirroring all admin-v2 web functionality. Same business logic, same backend API, native UX with platform-specific interactions. Built for staff operating in the field — washers, barbers, cashiers, admins.

**Companion to:** `2026-04-16-admin-v2-redesign.md` (web spec)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Flutter 3.x (Dart) |
| State Management | BLoC (flutter_bloc) |
| Navigation | GoRouter |
| HTTP Client | Dio |
| UI Base | Material 3 + custom widgets |
| Push Notifications | firebase_messaging + firebase_core |
| Camera | image_picker |
| Local Storage | flutter_secure_storage (token), shared_preferences (config) |
| Charts | fl_chart |
| DI | get_it + injectable |
| Forms | reactive_forms or manual with BLoC |
| Image Caching | cached_network_image |
| Date Utils | intl (DateFormat) |

### Not in V1
- Offline support / local DB
- Maps (google_maps_flutter)
- GPS / geolocation
- Biometric auth
- Deep linking (beyond push notification routing)

---

## Architecture — Clean Architecture

Same layer structure as admin-v2 web, adapted to Flutter/BLoC.

### Layer Diagram

```
UI (Widget) → BLoC → Use Case → Repository Interface → API Repository → Backend
       ↑                                                       |
       └──────────── Mapper (API response → Entity) ←──────────┘
```

**Dependency rule:** same as web — arrows point inward.

### Folder Structure

```
apps/admin-mobile/
├── lib/
│   ├── domain/                         # Zero external dependencies
│   │   ├── entities/
│   │   │   ├── reservation.dart
│   │   │   ├── service.dart
│   │   │   ├── client_resource.dart
│   │   │   ├── service_log.dart
│   │   │   ├── user.dart
│   │   │   ├── tenant.dart
│   │   │   └── availability.dart
│   │   ├── repositories/               # Abstract interfaces
│   │   │   ├── reservation_repository.dart
│   │   │   ├── service_repository.dart
│   │   │   ├── client_resource_repository.dart
│   │   │   ├── service_log_repository.dart
│   │   │   ├── user_repository.dart
│   │   │   ├── tenant_repository.dart
│   │   │   └── auth_repository.dart
│   │   └── value_objects/
│   │       ├── money.dart
│   │       ├── time_slot.dart
│   │       └── date_range.dart
│   │
│   ├── application/                    # Use cases + BLoCs
│   │   ├── use_cases/
│   │   │   ├── reservations/
│   │   │   │   ├── get_reservations.dart
│   │   │   │   ├── create_reservation.dart
│   │   │   │   ├── cancel_reservation.dart
│   │   │   │   └── transition_reservation.dart
│   │   │   ├── services/
│   │   │   ├── service_logs/
│   │   │   ├── clients/
│   │   │   ├── team/
│   │   │   ├── reports/
│   │   │   ├── settings/
│   │   │   └── auth/
│   │   ├── blocs/
│   │   │   ├── auth/
│   │   │   │   ├── auth_bloc.dart
│   │   │   │   ├── auth_event.dart
│   │   │   │   └── auth_state.dart
│   │   │   ├── reservations/
│   │   │   │   ├── reservations_bloc.dart
│   │   │   │   ├── reservations_event.dart
│   │   │   │   └── reservations_state.dart
│   │   │   ├── dashboard/
│   │   │   ├── service_logs/
│   │   │   ├── clients/
│   │   │   ├── services/
│   │   │   ├── team/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   └── dto/
│   │
│   ├── infrastructure/                 # Concrete implementations
│   │   ├── api/
│   │   │   ├── dio_client.dart         # Dio instance + interceptors
│   │   │   ├── repositories/           # API implementations
│   │   │   │   ├── api_reservation_repository.dart
│   │   │   │   ├── api_service_repository.dart
│   │   │   │   ├── api_client_resource_repository.dart
│   │   │   │   └── ...
│   │   │   └── mappers/
│   │   │       ├── reservation_mapper.dart
│   │   │       ├── service_mapper.dart
│   │   │       └── ...
│   │   ├── storage/
│   │   │   ├── secure_storage.dart     # Token (flutter_secure_storage)
│   │   │   └── preferences.dart        # Config (shared_preferences)
│   │   ├── push/
│   │   │   └── firebase_push_service.dart
│   │   └── camera/
│   │       └── camera_service.dart     # image_picker wrapper
│   │
│   ├── presentation/                   # UI layer
│   │   ├── app/
│   │   │   ├── app.dart                # MaterialApp + GoRouter
│   │   │   ├── router.dart             # Route definitions
│   │   │   └── theme.dart              # ThemeData (M3 customized)
│   │   ├── widgets/                    # Shared UI components
│   │   │   ├── cards/
│   │   │   ├── buttons/
│   │   │   ├── inputs/
│   │   │   ├── dialogs/
│   │   │   ├── skeletons/
│   │   │   └── status_badge.dart
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── login_page.dart
│   │   │   │   └── register_page.dart
│   │   │   ├── onboarding/
│   │   │   │   └── onboarding_banner.dart
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard_page.dart
│   │   │   │   ├── widgets/
│   │   │   │   │   ├── live_tracker_widget.dart
│   │   │   │   │   ├── revenue_cards.dart
│   │   │   │   │   ├── quick_actions.dart
│   │   │   │   │   └── upcoming_reservations.dart
│   │   │   ├── reservations/
│   │   │   │   ├── reservations_page.dart
│   │   │   │   ├── reservation_detail_page.dart
│   │   │   │   ├── create_reservation_page.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── timeline_view.dart
│   │   │   │       ├── reservation_card.dart
│   │   │   │       └── status_action_buttons.dart
│   │   │   ├── service_logs/
│   │   │   │   ├── service_log_page.dart
│   │   │   │   ├── new_service_log_page.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── daily_summary_card.dart
│   │   │   │       └── service_log_card.dart
│   │   │   ├── clients/
│   │   │   │   ├── clients_page.dart
│   │   │   │   ├── client_detail_page.dart
│   │   │   │   └── widgets/
│   │   │   │       └── client_card.dart
│   │   │   ├── services/
│   │   │   │   ├── services_page.dart
│   │   │   │   └── widgets/
│   │   │   │       └── service_card.dart
│   │   │   ├── team/
│   │   │   │   └── team_page.dart
│   │   │   ├── reports/
│   │   │   │   ├── reports_page.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── revenue_chart.dart
│   │   │   │       ├── payment_donut.dart
│   │   │   │       └── daily_breakdown_table.dart
│   │   │   ├── settings/
│   │   │   │   ├── settings_page.dart
│   │   │   │   └── tabs/
│   │   │   │       ├── general_tab.dart
│   │   │   │       ├── schedule_tab.dart
│   │   │   │       ├── gallery_tab.dart
│   │   │   │       ├── custom_fields_tab.dart
│   │   │   │       ├── permissions_tab.dart
│   │   │   │       └── brand_tab.dart
│   │   │   └── super_admin/
│   │   │       ├── super_admin_dashboard.dart
│   │   │       ├── tenants_page.dart
│   │   │       └── users_page.dart
│   │   └── layout/
│   │       ├── app_shell.dart          # Scaffold + bottom nav
│   │       ├── bottom_nav_bar.dart
│   │       └── app_top_bar.dart
│   │
│   ├── shared/
│   │   ├── constants/
│   │   ├── utils/
│   │   └── extensions/
│   │
│   ├── injection.dart                  # get_it setup
│   └── main.dart
│
├── test/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── presentation/
│
├── pubspec.yaml
├── analysis_options.yaml
└── firebase.json
```

### BLoC Example Flow

```dart
// domain/repositories/reservation_repository.dart
abstract class ReservationRepository {
  Future<PaginatedResult<Reservation>> getAll(ReservationFilters filters);
  Future<Reservation> getById(String id);
  Future<Reservation> create(CreateReservationDTO data);
  Future<Reservation> cancel(String id, String reason);
  Future<Reservation> transition(String id, ReservationAction action);
}

// application/use_cases/reservations/get_reservations.dart
class GetReservationsUseCase {
  final ReservationRepository _repo;
  GetReservationsUseCase(this._repo);

  Future<PaginatedResult<Reservation>> call(ReservationFilters filters) {
    return _repo.getAll(filters);
  }
}

// application/blocs/reservations/reservations_bloc.dart
class ReservationsBloc extends Bloc<ReservationsEvent, ReservationsState> {
  final GetReservationsUseCase _getReservations;

  ReservationsBloc(this._getReservations) : super(ReservationsInitial()) {
    on<LoadReservations>((event, emit) async {
      emit(ReservationsLoading());
      try {
        final result = await _getReservations(event.filters);
        emit(ReservationsLoaded(result));
      } catch (e) {
        emit(ReservationsError(e.toString()));
      }
    });
  }
}

// presentation/pages/reservations/reservations_page.dart
class ReservationsPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReservationsBloc, ReservationsState>(
      builder: (context, state) {
        return switch (state) {
          ReservationsLoading() => const SkeletonList(),
          ReservationsLoaded(data: final data) => TimelineView(reservations: data),
          ReservationsError(message: final msg) => ErrorWidget(message: msg),
          _ => const SizedBox.shrink(),
        };
      },
    );
  }
}
```

---

## Design System

### Theme — Same as Web

Shared design tokens, implemented via Flutter ThemeData:

| Token | Value | Flutter |
|-------|-------|---------|
| Primary | Indigo-600 `#4F46E5` | `colorScheme.primary` |
| Background | Slate-50 `#F8FAFC` | `colorScheme.surface` |
| Card | White + Slate-200 border | `CardTheme` |
| Text Primary | Slate-900 | `colorScheme.onSurface` |
| Text Secondary | Slate-600 | `colorScheme.onSurfaceVariant` |
| Success | Emerald-500 | Custom extension |
| Error | Rose-500 | `colorScheme.error` |
| Warning | Amber-500 | Custom extension |
| Info | Sky-500 | Custom extension |

### Typography

- **Font:** Inter (same as web)
- Headings: FontWeight.w600
- Body: FontWeight.w400
- Labels: FontWeight.w500
- Scale: 12sp small, 14sp base, 16sp subtitle, 20sp heading, 28sp page title

### Status Colors (Reservation)

Same as web: Amber (pending), Sky (confirmed), Indigo (in progress), Emerald (completed), Rose (cancelled), Slate (no-show).

### Tenant Brand Palettes

Same 12-15 curated palettes. Applied via dynamic ThemeData generation at runtime based on tenant settings.

### Animations

- Page transitions: SharedAxisTransition (horizontal)
- Cards: subtle scale on tap (0.97)
- Pull-to-refresh on all list pages
- Shimmer skeleton loaders
- Hero animations between list → detail

---

## Navigation

### Bottom Navigation Bar (5 items)

```
┌─────────────────────────────────────┐
│  🏠      📋      ➕      📊      ⋯  │
│ Home   Reserv.  New    Reports  More│
└─────────────────────────────────────┘
```

- **Home** — Dashboard
- **Reservaciones** — Timeline + filters
- **+ (FAB central)** — Bottom sheet: Nueva Reserva, Walk-in, Bloquear Horario
- **Reportes** — Charts + tables
- **Más** — Bottom sheet: Clientes, Servicios, Equipo, Settings

### Top App Bar

- Title: page name or breadcrumb
- Leading: back arrow (when in sub-page)
- Actions: search icon (opens search overlay), notification bell (badge), avatar (profile sheet)

### Route Structure

```
/login
/register
/dashboard
/reservations
/reservations/:id
/reservations/create
/service-logs
/service-logs/new
/clients
/clients/:id
/services
/team
/reports
/settings
/settings/:tab
/super-admin
/super-admin/tenants
/super-admin/users
```

### Auth Guard

GoRouter redirect — if no token, redirect to `/login`. If token but no tenant, redirect to onboarding.

---

## Pages (Mirror of Web)

All pages implement the same features as admin-v2 web. Key mobile-specific adaptations:

### Dashboard

- Greeting + date at top
- Revenue cards: horizontal scroll (3 cards)
- Live service tracker: vertical list of cards with elapsed time counter. Progress bar only if service has configured duration
- Quick actions: 3 large tappable cards (or via FAB +)
- Upcoming reservations: compact list, pull-to-refresh
- Notification badge in top bar

### Reservations

- **Primary:** Timeline view (vertical, full width)
- Cards: client + service + time + status badge
- Tap card → full screen detail page
- Swipe left on card → contextual quick action (confirm/cancel per status)
- Filter tabs: horizontal scroll chips (All, Pending, Confirmed, etc.)
- Date selector: tap opens date picker
- **No calendar view on mobile** (not useful on small screen)
- Create: full screen multi-step form (service → date → slot → client → confirm)

### Service Log

- Daily summary card at top
- Service list: cards with time, resource, service, employee, price, payment method
- Swipe left on in-progress → complete
- FAB or + button → new service log (full screen form)
- Service selection: visual cards (not dropdown)
- Date: swipe horizontal between days
- Pull-to-refresh

### Clients

- Search bar sticky at top
- Cards adaptive to custom fields (plate for car wash, name for barbershop)
- Last visit + total visits meta
- Star badge for frequent (>10 visits)
- Tap → full screen detail: info + stats + history tabs
- Create/edit: full screen form with dynamic custom fields

### Services

- 2-column grid of cards (image, name, price, duration, status)
- Tap card → edit (full screen form)
- Long press → toggle active/inactive
- Reorder via drag handles
- Create: full screen form with image picker (camera or gallery)

### Team

- List of cards: avatar, name, role badge
- Tap card → detail with role change dropdown
- Invite: bottom sheet with email + role picker

### Reports

- Range presets: horizontal scroll chips (Today, Week, Month, Custom)
- Stats cards: 2x2 grid
- Revenue area chart (fl_chart)
- Payment donut chart with amounts + percentages (cash, card, transfer + total)
- Daily breakdown: horizontal scrollable table
- Tap row → day detail
- No PDF export on mobile (open web for that)

### Settings

- List of setting categories (General, Schedule, Gallery, Fields, Permissions, Brand)
- Tap → full screen for each tab
- General: form fields + image picker for logo/cover
- Schedule: day cards with time range editors
- Gallery: grid with camera/gallery upload
- Custom fields: reorderable list
- Permissions: matrix (horizontal scroll, first column sticky)
- Brand: palette grid with live preview

### Auth — Login

- Centered form: email + password
- Link to register
- Biometric login NOT in V1

### Onboarding — Register

- 4 fields: business name, your name, email, password
- Submit → dashboard with onboarding banner

### Onboarding — Contextual

- Banner widget at top of dashboard (collapsible)
- Progress indicator (X of 6 steps)
- Each step tappable → navigates to section
- "Skip" dismisses, reappears as subtle indicator

### Super Admin

- Same pages as web, adapted to mobile layout
- Dashboard: 2x2 stat cards + trend chart
- Tenants: searchable list, swipe for actions (suspend/activate)
- Users: searchable list

---

## Native Features

### Push Notifications (Firebase)

**Events that trigger push:**
- New reservation created (for assigned employee + admin)
- Reservation cancelled by client
- Reservation confirmed
- No-show detected (time passed, no check-in)
- New client booking from public page

**Behavior:**
- Tap notification → deep link to relevant page (reservation detail, dashboard)
- Badge count on app icon
- Foreground: in-app banner (overlay toast)
- Background: system notification
- Permission request on first relevant action, not on app launch

**Backend requirement:** Firebase Admin SDK integration for sending push. Topic-based: `tenant_{id}_admins`, `tenant_{id}_employee_{id}`.

### Camera

**Use cases:**
- Photo before/after service (attached to service log)
- Upload service image (in Services CRUD)
- Upload logo/cover (in Settings)
- Upload gallery photos (in Settings)

**Implementation:**
- image_picker with source selection (camera or gallery)
- Compress before upload (max 1080px, 80% quality)
- Upload via existing `POST /uploads` endpoint
- Preview before confirming upload

---

## API Integration

Same endpoints as web spec. See `2026-04-16-admin-v2-redesign.md` for full API list.

### Dio Interceptors

```dart
class AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = secureStorage.getToken();
    final tenant = preferences.getTenantSlug();
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    if (tenant != null) options.headers['X-Tenant'] = tenant;
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Clear token, navigate to login
      authBloc.add(LogoutRequested());
    }
    handler.next(err);
  }
}
```

---

## Authentication

- Token stored in flutter_secure_storage (encrypted)
- Tenant slug in shared_preferences
- Same flow: login → receive token + tenant → store → navigate to dashboard
- 401 response → clear storage → redirect to login
- Super admin flag stored alongside token

---

## Non-Goals (V1)

- Offline support / local database
- Maps / GPS / geolocation
- Biometric authentication
- Deep linking beyond push notifications
- PDF export (use web for that)
- Tablet-specific layouts (phone layout scales OK)
- Public booking page (web only — SEO requirement)
- Widget / watch app
- Dark mode
