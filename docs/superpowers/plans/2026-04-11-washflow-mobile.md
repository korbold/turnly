# WashFlow Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Flutter client app for car wash customers to register vehicles, book reservations, and view wash history.

**Architecture:** Feature-based architecture with domain/application/infrastructure/presentation layers per feature. Riverpod 2.5 with codegen for state management. go_router for navigation. Dio for HTTP. Sealed Failure classes for error handling.

**Tech Stack:** Flutter 3.x, Riverpod 2.5 (codegen), go_router, Dio, fpdart, get_it/injectable, flutter_secure_storage

---

### Task 1: Flutter setup + core layer

**Files:**
- Create: `apps/mobile/` (Flutter project)
- Create: `lib/core/` (di, error, network, router, storage, theme)

- [ ] **Step 1: Create Flutter project**

```bash
cd apps/mobile
flutter create . --org com.washflow --project-name washflow_mobile
```

- [ ] **Step 2: Add dependencies**

All packages from spec: flutter_riverpod, riverpod_annotation, go_router, dio, fpdart, get_it, injectable, shared_preferences, flutter_secure_storage, intl, cached_network_image + dev deps.

- [ ] **Step 3: Create Failure sealed classes**

`lib/core/error/failures.dart`: NetworkFailure, ServerFailure, AuthFailure, TenantFailure, NotFoundFailure.

- [ ] **Step 4: Create Dio client with interceptors**

`lib/core/network/dio_client.dart`: base URL from config, auth interceptor (adds Bearer token from secure storage), tenant interceptor (adds X-Tenant header), error interceptor (maps DioException to Failure types).

- [ ] **Step 5: Create secure storage wrapper**

`lib/core/storage/secure_storage.dart`: save/read/delete token, save/read tenant slug.

- [ ] **Step 6: Create app router**

`lib/core/router/app_router.dart`: go_router with routes for /login, /register, /home, /reservations, /reservations/create, /reservations/:id, /vehicles, /vehicles/:id/history. Auth redirect guard.

- [ ] **Step 7: Create app theme**

`lib/core/theme/app_theme.dart`: Material 3 theme with car wash branding colors.

- [ ] **Step 8: Set up dependency injection**

`lib/core/di/injection.dart`: get_it + injectable setup.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/
git commit -m "feat(fase-3): Flutter setup with core layer - DI, networking, routing, storage"
```

---

### Task 2: Shared widgets

**Files:**
- Create: `lib/shared/widgets/async_value_widget.dart`
- Create: `lib/shared/widgets/error_view.dart`
- Create: `lib/shared/widgets/loading_view.dart`
- Create: `lib/shared/extensions/date_extensions.dart`

- [ ] **Step 1: Create AsyncValueWidget**

Generic widget that handles AsyncValue<T> — shows loading, error, or data widget. Exact code from spec.

- [ ] **Step 2: Create ErrorView and LoadingView**

ErrorView: message + retry button. LoadingView: centered CircularProgressIndicator.

- [ ] **Step 3: Create date extensions**

Format helpers: `toDisplayDate()`, `toDisplayTime()`, `toApiFormat()`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/shared/
git commit -m "feat(fase-3): shared widgets and extensions"
```

---

### Task 3: Auth feature

**Files:**
- Create: `lib/features/auth/domain/` (entities, repository interface)
- Create: `lib/features/auth/application/` (auth notifier)
- Create: `lib/features/auth/infrastructure/` (auth repository impl, DTOs)
- Create: `lib/features/auth/presentation/screens/login_screen.dart`
- Create: `lib/features/auth/presentation/screens/register_screen.dart`

- [ ] **Step 1: Create auth domain layer**

User entity, IAuthRepository interface (login, register, logout, getCurrentUser).

- [ ] **Step 2: Create auth infrastructure**

AuthRepositoryImpl using Dio. LoginDTO, RegisterDTO. Store token in secure storage on success.

- [ ] **Step 3: Create auth notifier**

Riverpod AsyncNotifier managing auth state. Methods: login, register, logout, checkAuth.

- [ ] **Step 4: Create LoginScreen**

Email + password fields, login button, link to register. Shows error on failure.

- [ ] **Step 5: Create RegisterScreen**

Name, email, phone, password fields. Auto-navigates to home on success.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/auth/
git commit -m "feat(fase-3): auth feature - login and register screens"
```

---

### Task 4: Reservations feature

**Files:**
- Create: `lib/features/reservations/domain/` (entity, enum, repository interface)
- Create: `lib/features/reservations/application/` (notifiers)
- Create: `lib/features/reservations/infrastructure/` (repository impl, DTOs)
- Create: `lib/features/reservations/presentation/screens/` (3 screens)
- Create: `lib/features/reservations/presentation/widgets/` (slot_picker, reservation_card, status_badge)

- [ ] **Step 1: Create reservations domain**

Reservation entity, ReservationStatus enum, IReservationRepository (getAll, getById, create, getAvailableSlots).

- [ ] **Step 2: Create reservations infrastructure**

ReservationRepositoryImpl, ReservationDTO with fromJson/toEntity mapping.

- [ ] **Step 3: Create notifiers**

ReservationsNotifier (list + refresh), CreateReservationNotifier (form state + submit), AvailableSlotsNotifier (fetch slots for date+service).

- [ ] **Step 4: Create SlotPicker widget**

Date selector + time grid showing available slots. Tap to select. Disabled slots greyed out.

- [ ] **Step 5: Create ReservationCard + StatusBadge**

Card: service name, date/time, vehicle plate, status badge. StatusBadge: colored chip per status.

- [ ] **Step 6: Create ReservationsScreen**

List of user's reservations with pull-to-refresh. FAB → CreateReservationScreen.

- [ ] **Step 7: Create CreateReservationScreen**

Step flow: select vehicle → select service → pick date/slot → confirm. Uses AvailableSlotsNotifier.

- [ ] **Step 8: Create ReservationDetailScreen**

Full details, status timeline, cancel button (if pending/confirmed).

- [ ] **Step 9: Run build_runner**

```bash
dart run build_runner build --delete-conflicting-outputs
```

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/lib/features/reservations/
git commit -m "feat(fase-3): reservations feature with slot picker"
```

---

### Task 5: Vehicles feature

**Files:**
- Create: `lib/features/vehicles/domain/`
- Create: `lib/features/vehicles/application/`
- Create: `lib/features/vehicles/infrastructure/`
- Create: `lib/features/vehicles/presentation/screens/vehicles_screen.dart`
- Create: `lib/features/vehicles/presentation/screens/vehicle_history_screen.dart`
- Create: `lib/features/vehicles/presentation/screens/add_vehicle_screen.dart`

- [ ] **Step 1: Create vehicles domain + infrastructure**

Vehicle entity, IVehicleRepository (getAll, create, getHistory), VehicleRepositoryImpl, VehicleDTO.

- [ ] **Step 2: Create vehicle notifiers**

VehiclesNotifier (list), VehicleHistoryNotifier (wash history for vehicle).

- [ ] **Step 3: Create VehiclesScreen**

List of user's vehicles (plate, brand, model, color). FAB → AddVehicleScreen. Tap → VehicleHistoryScreen.

- [ ] **Step 4: Create AddVehicleScreen**

Form: plate, brand, model, color, type dropdown (sedan/suv/pickup/van/motorcycle/other).

- [ ] **Step 5: Create VehicleHistoryScreen**

List of wash logs for vehicle: date, service, price, status.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/vehicles/
git commit -m "feat(fase-3): vehicles feature with history"
```

---

### Task 6: Home feature + app wiring

**Files:**
- Create: `lib/features/home/presentation/screens/home_screen.dart`
- Modify: `lib/main.dart`

- [ ] **Step 1: Create HomeScreen**

Welcome message, upcoming reservations (next 3), quick action buttons ("Nueva reservación", "Mis vehículos"). Bottom navigation: Home, Reservaciones, Vehículos, Perfil.

- [ ] **Step 2: Wire up main.dart**

ProviderScope, MaterialApp.router with go_router, theme, localization.

- [ ] **Step 3: Verify app builds**

```bash
flutter analyze
flutter build apk --debug
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/
git commit -m "feat(fase-3): home screen and app wiring complete"
```
