# Admin Mobile (Flutter) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build native Flutter mobile app mirroring admin-v2 web with Clean Architecture, BLoC, push notifications, and camera support.

**Architecture:** Clean Architecture with 4 layers: domain (entities + repository interfaces), application (use cases + BLoCs), infrastructure (Dio API repos + mappers + storage + push + camera), presentation (Material 3 pages + widgets). Dependency rule: arrows point inward.

**Tech Stack:** Flutter 3.x, Dart, flutter_bloc, GoRouter, Dio, Material 3, firebase_messaging, image_picker, flutter_secure_storage, shared_preferences, fl_chart, get_it, cached_network_image, intl

**Spec:** `docs/superpowers/specs/2026-04-16-admin-mobile-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `apps/admin-mobile/pubspec.yaml`
- Create: `apps/admin-mobile/analysis_options.yaml`
- Create: `apps/admin-mobile/lib/main.dart`

- [ ] **Step 1: Create Flutter project**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps
flutter create admin-mobile --org com.turnly --platforms ios,android
```

- [ ] **Step 2: Replace pubspec.yaml with all dependencies**

```yaml
# apps/admin-mobile/pubspec.yaml
name: admin_mobile
description: Turnly Admin Mobile App
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: ^3.5.0

dependencies:
  flutter:
    sdk: flutter

  # State Management
  flutter_bloc: ^8.1.6
  equatable: ^2.0.7

  # Navigation
  go_router: ^14.6.2

  # Networking
  dio: ^5.7.0

  # Local Storage
  flutter_secure_storage: ^9.2.4
  shared_preferences: ^2.3.4

  # Firebase
  firebase_core: ^3.8.1
  firebase_messaging: ^15.1.6

  # Camera
  image_picker: ^1.1.2

  # Charts
  fl_chart: ^0.70.2

  # UI
  cached_network_image: ^3.4.1
  shimmer: ^3.0.0
  intl: ^0.19.0
  google_fonts: ^6.2.1
  lucide_icons: ^0.257.0

  # DI
  get_it: ^8.0.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0
  bloc_test: ^9.1.7
  mocktail: ^1.0.4

flutter:
  uses-material-design: true
```

- [ ] **Step 3: Create folder structure**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/admin-mobile/lib
mkdir -p domain/entities domain/repositories domain/value_objects
mkdir -p application/use_cases/auth application/use_cases/reservations application/use_cases/services application/use_cases/service_logs application/use_cases/clients application/use_cases/team application/use_cases/reports application/use_cases/settings
mkdir -p application/blocs/auth application/blocs/reservations application/blocs/services application/blocs/service_logs application/blocs/clients application/blocs/team application/blocs/reports application/blocs/settings application/blocs/dashboard application/blocs/super_admin
mkdir -p application/dto
mkdir -p infrastructure/api/repositories infrastructure/api/mappers infrastructure/storage infrastructure/push infrastructure/camera
mkdir -p presentation/app presentation/pages/auth presentation/pages/dashboard presentation/pages/reservations presentation/pages/service_logs presentation/pages/clients presentation/pages/services presentation/pages/team presentation/pages/reports presentation/pages/settings presentation/pages/onboarding presentation/pages/super_admin
mkdir -p presentation/widgets/cards presentation/widgets/buttons presentation/widgets/inputs presentation/widgets/dialogs presentation/widgets/skeletons
mkdir -p presentation/layout
mkdir -p shared/constants shared/utils shared/extensions
```

- [ ] **Step 4: Create minimal main.dart**

```dart
// apps/admin-mobile/lib/main.dart
import 'package:flutter/material.dart';

void main() {
  runApp(const TurnlyApp());
}

class TurnlyApp extends StatelessWidget {
  const TurnlyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Turnly Admin',
      home: Scaffold(body: Center(child: Text('Turnly Admin'))),
    );
  }
}
```

- [ ] **Step 5: Run and verify**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/admin-mobile
flutter pub get
flutter run
```

- [ ] **Step 6: Commit**

```bash
git add apps/admin-mobile/
git commit -m "feat(admin-mobile): scaffold Flutter project with clean architecture folders"
```

---

## Task 2: Theme & Design System

**Files:**
- Create: `apps/admin-mobile/lib/presentation/app/theme.dart`
- Create: `apps/admin-mobile/lib/shared/constants/colors.dart`
- Create: `apps/admin-mobile/lib/shared/constants/status.dart`

- [ ] **Step 1: Create color constants**

```dart
// apps/admin-mobile/lib/shared/constants/colors.dart
import 'package:flutter/material.dart';

class AppColors {
  static const primary = Color(0xFF4F46E5);
  static const primaryHover = Color(0xFF4338CA);
  static const primaryMuted = Color(0xFFEEF2FF);

  static const background = Color(0xFFF8FAFC);
  static const card = Colors.white;
  static const cardBorder = Color(0xFFE2E8F0);

  static const textPrimary = Color(0xFF0F172A);
  static const textSecondary = Color(0xFF475569);
  static const textMuted = Color(0xFF94A3B8);

  static const success = Color(0xFF10B981);
  static const successMuted = Color(0xFFD1FAE5);
  static const error = Color(0xFFF43F5E);
  static const errorMuted = Color(0xFFFFE4E6);
  static const warning = Color(0xFFF59E0B);
  static const warningMuted = Color(0xFFFEF3C7);
  static const info = Color(0xFF0EA5E9);
  static const infoMuted = Color(0xFFE0F2FE);

  // Reservation status
  static const statusPending = Color(0xFFF59E0B);
  static const statusPendingBg = Color(0xFFFEF3C7);
  static const statusConfirmed = Color(0xFF0EA5E9);
  static const statusConfirmedBg = Color(0xFFE0F2FE);
  static const statusInProgress = Color(0xFF4F46E5);
  static const statusInProgressBg = Color(0xFFEEF2FF);
  static const statusCompleted = Color(0xFF10B981);
  static const statusCompletedBg = Color(0xFFD1FAE5);
  static const statusCancelled = Color(0xFFF43F5E);
  static const statusCancelledBg = Color(0xFFFFE4E6);
  static const statusNoShow = Color(0xFF64748B);
  static const statusNoShowBg = Color(0xFFF1F5F9);
}
```

- [ ] **Step 2: Create status constants**

```dart
// apps/admin-mobile/lib/shared/constants/status.dart
import 'package:flutter/material.dart';
import 'colors.dart';

class StatusConfig {
  final String label;
  final Color color;
  final Color bgColor;

  const StatusConfig({required this.label, required this.color, required this.bgColor});
}

const reservationStatusConfig = {
  'pending': StatusConfig(label: 'Pendiente', color: AppColors.statusPending, bgColor: AppColors.statusPendingBg),
  'confirmed': StatusConfig(label: 'Confirmada', color: AppColors.statusConfirmed, bgColor: AppColors.statusConfirmedBg),
  'in_progress': StatusConfig(label: 'En Progreso', color: AppColors.statusInProgress, bgColor: AppColors.statusInProgressBg),
  'completed': StatusConfig(label: 'Completada', color: AppColors.statusCompleted, bgColor: AppColors.statusCompletedBg),
  'cancelled': StatusConfig(label: 'Cancelada', color: AppColors.statusCancelled, bgColor: AppColors.statusCancelledBg),
  'no_show': StatusConfig(label: 'No Show', color: AppColors.statusNoShow, bgColor: AppColors.statusNoShowBg),
};

const paymentMethodLabels = {
  'cash': 'Efectivo',
  'card': 'Tarjeta',
  'transfer': 'Transferencia',
  'other': 'Otro',
};
```

- [ ] **Step 3: Create theme**

```dart
// apps/admin-mobile/lib/presentation/app/theme.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../shared/constants/colors.dart';

class AppTheme {
  static ThemeData get light {
    final textTheme = GoogleFonts.interTextTheme();

    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        surface: AppColors.background,
        error: AppColors.error,
      ),
      scaffoldBackgroundColor: AppColors.background,
      textTheme: textTheme.copyWith(
        headlineLarge: textTheme.headlineLarge?.copyWith(fontSize: 28, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        headlineMedium: textTheme.headlineMedium?.copyWith(fontSize: 20, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        titleMedium: textTheme.titleMedium?.copyWith(fontSize: 16, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
        bodyLarge: textTheme.bodyLarge?.copyWith(fontSize: 14, color: AppColors.textPrimary),
        bodyMedium: textTheme.bodyMedium?.copyWith(fontSize: 14, color: AppColors.textSecondary),
        bodySmall: textTheme.bodySmall?.copyWith(fontSize: 12, color: AppColors.textMuted),
        labelLarge: textTheme.labelLarge?.copyWith(fontSize: 14, fontWeight: FontWeight.w500),
      ),
      cardTheme: CardTheme(
        color: AppColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.cardBorder),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.cardBorder)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.cardBorder)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.primary, width: 2)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
    );
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin-mobile/lib/
git commit -m "feat(admin-mobile): add theme and design system constants"
```

---

## Task 3: Domain Layer — Entities

**Files:**
- Create: `apps/admin-mobile/lib/domain/entities/reservation.dart`
- Create: `apps/admin-mobile/lib/domain/entities/service.dart`
- Create: `apps/admin-mobile/lib/domain/entities/service_log.dart`
- Create: `apps/admin-mobile/lib/domain/entities/client_resource.dart`
- Create: `apps/admin-mobile/lib/domain/entities/user.dart`
- Create: `apps/admin-mobile/lib/domain/entities/tenant.dart`
- Create: `apps/admin-mobile/lib/domain/entities/availability.dart`

- [ ] **Step 1: Create reservation entity**

```dart
// apps/admin-mobile/lib/domain/entities/reservation.dart
import 'package:equatable/equatable.dart';

enum ReservationStatus { pending, confirmed, inProgress, completed, cancelled, noShow }

enum ReservationAction { confirm, start, complete, cancel }

extension ReservationStatusX on ReservationStatus {
  String get apiValue => switch (this) {
    ReservationStatus.pending => 'pending',
    ReservationStatus.confirmed => 'confirmed',
    ReservationStatus.inProgress => 'in_progress',
    ReservationStatus.completed => 'completed',
    ReservationStatus.cancelled => 'cancelled',
    ReservationStatus.noShow => 'no_show',
  };

  static ReservationStatus fromApi(String value) => switch (value) {
    'pending' => ReservationStatus.pending,
    'confirmed' => ReservationStatus.confirmed,
    'in_progress' => ReservationStatus.inProgress,
    'completed' => ReservationStatus.completed,
    'cancelled' => ReservationStatus.cancelled,
    'no_show' => ReservationStatus.noShow,
    _ => ReservationStatus.pending,
  };
}

extension ReservationActionX on ReservationAction {
  String get apiValue => switch (this) {
    ReservationAction.confirm => 'confirm',
    ReservationAction.start => 'start',
    ReservationAction.complete => 'complete',
    ReservationAction.cancel => 'cancel',
  };
}

class Reservation extends Equatable {
  final String id;
  final String clientId;
  final String clientResourceId;
  final String serviceId;
  final String? assignedTo;
  final DateTime scheduledAt;
  final DateTime estimatedEnd;
  final ReservationStatus status;
  final String? notes;
  final DateTime? cancelledAt;
  final String? cancelReason;
  final String createdBy;
  final DateTime createdAt;
  final String? clientResourceLabel;
  final String? clientResourcePlate;
  final String? serviceName;
  final String? servicePrice;
  final String? clientName;
  final String? clientEmail;

  const Reservation({
    required this.id, required this.clientId, required this.clientResourceId,
    required this.serviceId, this.assignedTo, required this.scheduledAt,
    required this.estimatedEnd, required this.status, this.notes,
    this.cancelledAt, this.cancelReason, required this.createdBy,
    required this.createdAt, this.clientResourceLabel, this.clientResourcePlate,
    this.serviceName, this.servicePrice, this.clientName, this.clientEmail,
  });

  @override
  List<Object?> get props => [id, status];
}

class AvailableSlot extends Equatable {
  final DateTime start;
  final DateTime end;
  final int available;

  const AvailableSlot({required this.start, required this.end, required this.available});

  @override
  List<Object?> get props => [start, end, available];
}

class ReservationFilters extends Equatable {
  final String? dateFrom;
  final String? dateTo;
  final String? status;
  final String? serviceId;
  final int? page;

  const ReservationFilters({this.dateFrom, this.dateTo, this.status, this.serviceId, this.page});

  @override
  List<Object?> get props => [dateFrom, dateTo, status, serviceId, page];
}
```

- [ ] **Step 2: Create service entity**

```dart
// apps/admin-mobile/lib/domain/entities/service.dart
import 'package:equatable/equatable.dart';

class Service extends Equatable {
  final String id;
  final String name;
  final String? description;
  final double price;
  final bool isActive;
  final String? imageUrl;
  final int sortOrder;
  final DateTime createdAt;

  const Service({
    required this.id, required this.name, this.description,
    required this.price, required this.isActive, this.imageUrl,
    required this.sortOrder, required this.createdAt,
  });

  @override
  List<Object?> get props => [id];
}
```

- [ ] **Step 3: Create service_log entity**

```dart
// apps/admin-mobile/lib/domain/entities/service_log.dart
import 'package:equatable/equatable.dart';

enum PaymentMethod { cash, card, transfer, other }

extension PaymentMethodX on PaymentMethod {
  String get apiValue => name;
  static PaymentMethod fromApi(String v) => PaymentMethod.values.firstWhere((e) => e.name == v, orElse: () => PaymentMethod.other);
}

class ServiceLog extends Equatable {
  final String id;
  final String clientResourceId;
  final String serviceId;
  final String? reservationId;
  final String attendedBy;
  final String createdBy;
  final DateTime startedAt;
  final DateTime? finishedAt;
  final double priceCharged;
  final PaymentMethod paymentMethod;
  final String status;
  final String? notes;
  final String logDate;
  final DateTime createdAt;
  final String? clientResourcePlate;
  final String? clientResourceBrand;
  final String? serviceName;
  final String? attendantName;

  const ServiceLog({
    required this.id, required this.clientResourceId, required this.serviceId,
    this.reservationId, required this.attendedBy, required this.createdBy,
    required this.startedAt, this.finishedAt, required this.priceCharged,
    required this.paymentMethod, required this.status, this.notes,
    required this.logDate, required this.createdAt,
    this.clientResourcePlate, this.clientResourceBrand,
    this.serviceName, this.attendantName,
  });

  @override
  List<Object?> get props => [id];
}

class DailySummary extends Equatable {
  final int totalWashes;
  final double totalRevenue;
  final Map<String, dynamic> byPaymentMethod;
  final Map<String, int> byStatus;

  const DailySummary({
    required this.totalWashes, required this.totalRevenue,
    required this.byPaymentMethod, required this.byStatus,
  });

  @override
  List<Object?> get props => [totalWashes, totalRevenue];
}
```

- [ ] **Step 4: Create client_resource entity**

```dart
// apps/admin-mobile/lib/domain/entities/client_resource.dart
import 'package:equatable/equatable.dart';

class ClientResource extends Equatable {
  final String id;
  final String tenantId;
  final String clientId;
  final Map<String, dynamic>? data;
  final String? plate;
  final String? brand;
  final String? model;
  final String? color;
  final String? type;
  final DateTime createdAt;
  final String? clientName;
  final String? clientEmail;

  const ClientResource({
    required this.id, required this.tenantId, required this.clientId,
    this.data, this.plate, this.brand, this.model, this.color, this.type,
    required this.createdAt, this.clientName, this.clientEmail,
  });

  @override
  List<Object?> get props => [id];
}
```

- [ ] **Step 5: Create user entity**

```dart
// apps/admin-mobile/lib/domain/entities/user.dart
import 'package:equatable/equatable.dart';

enum UserRole { tenantAdmin, cashier, washer, client }

extension UserRoleX on UserRole {
  String get apiValue => switch (this) {
    UserRole.tenantAdmin => 'tenant_admin',
    UserRole.cashier => 'cashier',
    UserRole.washer => 'washer',
    UserRole.client => 'client',
  };
  static UserRole fromApi(String v) => switch (v) {
    'tenant_admin' => UserRole.tenantAdmin,
    'cashier' => UserRole.cashier,
    'washer' => UserRole.washer,
    _ => UserRole.client,
  };
}

class User extends Equatable {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool isSuperAdmin;
  final DateTime createdAt;
  final UserRole? role;

  const User({
    required this.id, required this.name, required this.email,
    this.phone, required this.isSuperAdmin, required this.createdAt, this.role,
  });

  @override
  List<Object?> get props => [id];
}
```

- [ ] **Step 6: Create tenant entity**

```dart
// apps/admin-mobile/lib/domain/entities/tenant.dart
import 'package:equatable/equatable.dart';

enum TenantPlan { trial, basic, pro }
enum TenantStatus { pending, active, suspended, cancelled }
enum BusinessType { carWash, barbershop, medical, spa, gym, other }

extension BusinessTypeX on BusinessType {
  String get apiValue => switch (this) {
    BusinessType.carWash => 'car_wash',
    BusinessType.barbershop => 'barbershop',
    BusinessType.medical => 'medical',
    BusinessType.spa => 'spa',
    BusinessType.gym => 'gym',
    BusinessType.other => 'other',
  };
}

class Tenant extends Equatable {
  final String id;
  final String slug;
  final String name;
  final String ownerName;
  final String email;
  final String? phone;
  final String? city;
  final String country;
  final TenantPlan plan;
  final TenantStatus status;
  final DateTime? trialEndsAt;
  final int onboardingStep;
  final DateTime? activatedAt;
  final DateTime createdAt;

  const Tenant({
    required this.id, required this.slug, required this.name,
    required this.ownerName, required this.email, this.phone, this.city,
    required this.country, required this.plan, required this.status,
    this.trialEndsAt, required this.onboardingStep, this.activatedAt,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [id];
}
```

- [ ] **Step 7: Create availability entity**

```dart
// apps/admin-mobile/lib/domain/entities/availability.dart
import 'package:equatable/equatable.dart';

class AvailabilitySlot extends Equatable {
  final String id;
  final int dayOfWeek;
  final String startTime;
  final String endTime;
  final int maxConcurrent;
  final bool isActive;

  const AvailabilitySlot({
    required this.id, required this.dayOfWeek, required this.startTime,
    required this.endTime, required this.maxConcurrent, required this.isActive,
  });

  @override
  List<Object?> get props => [id];
}

class AvailabilityBlock extends Equatable {
  final String id;
  final String date;
  final String? startTime;
  final String? endTime;
  final String? reason;
  final DateTime createdAt;

  const AvailabilityBlock({
    required this.id, required this.date, this.startTime, this.endTime,
    this.reason, required this.createdAt,
  });

  @override
  List<Object?> get props => [id];
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/admin-mobile/lib/domain/entities/
git commit -m "feat(admin-mobile): add domain entities with Equatable"
```

---

## Task 4: Domain Layer — Repository Interfaces

**Files:**
- Create: `apps/admin-mobile/lib/domain/repositories/auth_repository.dart`
- Create: `apps/admin-mobile/lib/domain/repositories/reservation_repository.dart`
- Create: `apps/admin-mobile/lib/domain/repositories/service_repository.dart`
- Create: `apps/admin-mobile/lib/domain/repositories/service_log_repository.dart`
- Create: `apps/admin-mobile/lib/domain/repositories/client_resource_repository.dart`
- Create: `apps/admin-mobile/lib/domain/repositories/user_repository.dart`
- Create: `apps/admin-mobile/lib/domain/repositories/tenant_repository.dart`
- Create: `apps/admin-mobile/lib/domain/repositories/report_repository.dart`
- Create: `apps/admin-mobile/lib/domain/repositories/availability_repository.dart`
- Create: `apps/admin-mobile/lib/domain/repositories/upload_repository.dart`
- Create: `apps/admin-mobile/lib/domain/repositories/super_admin_repository.dart`
- Create: `apps/admin-mobile/lib/domain/repositories/onboarding_repository.dart`

- [ ] **Step 1: Create shared paginated result type**

```dart
// apps/admin-mobile/lib/shared/types/paginated_result.dart
class PaginatedResult<T> {
  final List<T> data;
  final int currentPage;
  final int lastPage;
  final int perPage;
  final int total;

  const PaginatedResult({
    required this.data, required this.currentPage, required this.lastPage,
    required this.perPage, required this.total,
  });
}
```

- [ ] **Step 2: Create all repository interfaces**

```dart
// apps/admin-mobile/lib/domain/repositories/auth_repository.dart
import '../entities/user.dart';
import '../entities/tenant.dart';

class LoginResult {
  final User user;
  final String token;
  final Tenant? tenant;
  const LoginResult({required this.user, required this.token, this.tenant});
}

abstract class AuthRepository {
  Future<LoginResult> login(String email, String password);
  Future<LoginResult> register({required String name, required String email, required String password});
  Future<void> logout();
  Future<({User user, Tenant? tenant})> me();
}
```

```dart
// apps/admin-mobile/lib/domain/repositories/reservation_repository.dart
import '../entities/reservation.dart';
import '../../shared/types/paginated_result.dart';

abstract class ReservationRepository {
  Future<PaginatedResult<Reservation>> getAll(ReservationFilters filters);
  Future<Reservation> getById(String id);
  Future<Reservation> create({
    required String clientResourceId, required String serviceId,
    required String scheduledAt, String? assignedTo, String? notes,
  });
  Future<Reservation> cancel(String id, String reason);
  Future<Reservation> transition(String id, ReservationAction action);
  Future<List<AvailableSlot>> getAvailableSlots(String date, String serviceId);
}
```

```dart
// apps/admin-mobile/lib/domain/repositories/service_repository.dart
import '../entities/service.dart';
import '../../shared/types/paginated_result.dart';

abstract class ServiceRepository {
  Future<PaginatedResult<Service>> getAll({int? page});
  Future<Service> create({required String name, required double price, String? description, String? imageUrl, bool? isActive});
  Future<Service> update(String id, {String? name, double? price, String? description, String? imageUrl, bool? isActive, int? sortOrder});
  Future<void> delete(String id);
}
```

```dart
// apps/admin-mobile/lib/domain/repositories/service_log_repository.dart
import '../entities/service_log.dart';
import '../../shared/types/paginated_result.dart';

abstract class ServiceLogRepository {
  Future<PaginatedResult<ServiceLog>> getAll({String? date, int? page});
  Future<ServiceLog> getById(String id);
  Future<ServiceLog> create({
    required String clientResourceId, required String serviceId,
    required String attendedBy, required double priceCharged,
    required PaymentMethod paymentMethod, String? notes,
  });
  Future<ServiceLog> update(String id, {String? serviceId, String? attendedBy, double? priceCharged, PaymentMethod? paymentMethod, String? notes});
  Future<void> delete(String id);
  Future<ServiceLog> complete(String id);
  Future<DailySummary> getSummary(String date);
}
```

```dart
// apps/admin-mobile/lib/domain/repositories/client_resource_repository.dart
import '../entities/client_resource.dart';
import '../../shared/types/paginated_result.dart';

abstract class ClientResourceRepository {
  Future<PaginatedResult<ClientResource>> getAll({int? page, String? search});
  Future<ClientResource> getById(String id);
  Future<ClientResource> create({String? clientId, Map<String, dynamic>? data, String? plate, String? brand, String? model, String? color, String? type});
  Future<ClientResource> update(String id, {Map<String, dynamic>? data, String? plate, String? brand, String? model, String? color, String? type});
  Future<List<dynamic>> getHistory(String id);
}
```

```dart
// apps/admin-mobile/lib/domain/repositories/user_repository.dart
import '../entities/user.dart';
import '../../shared/types/paginated_result.dart';

abstract class UserRepository {
  Future<PaginatedResult<User>> getAll({UserRole? role, UserRole? excludeRole});
  Future<User> getById(String id);
  Future<User> invite(String email, UserRole role);
  Future<User> changeRole(String id, UserRole role);
}
```

```dart
// apps/admin-mobile/lib/domain/repositories/tenant_repository.dart
abstract class TenantRepository {
  Future<Map<String, dynamic>> getSettings();
  Future<Map<String, dynamic>> updateSettings(Map<String, dynamic> data);
  Future<List<Map<String, dynamic>>> getImages();
  Future<Map<String, dynamic>> addImage(String filePath);
  Future<void> deleteImage(String id);
  Future<void> reorderImages(List<String> ids);
}
```

```dart
// apps/admin-mobile/lib/domain/repositories/report_repository.dart
abstract class ReportRepository {
  Future<Map<String, dynamic>> getDaily(String date);
  Future<Map<String, dynamic>> getRange(String from, String to);
  Future<Map<String, dynamic>> getWeekly(String week);
  Future<Map<String, dynamic>> getMonthly(String month);
}
```

```dart
// apps/admin-mobile/lib/domain/repositories/availability_repository.dart
import '../entities/availability.dart';

abstract class AvailabilityRepository {
  Future<List<AvailabilitySlot>> getSlots();
  Future<List<AvailabilitySlot>> updateSlots(List<AvailabilitySlot> slots);
  Future<List<AvailabilityBlock>> getBlocks();
  Future<AvailabilityBlock> createBlock({required String date, String? startTime, String? endTime, String? reason});
  Future<void> deleteBlock(String id);
}
```

```dart
// apps/admin-mobile/lib/domain/repositories/upload_repository.dart
abstract class UploadRepository {
  Future<String> upload(String filePath, String folder);
}
```

```dart
// apps/admin-mobile/lib/domain/repositories/super_admin_repository.dart
import '../entities/tenant.dart';
import '../entities/user.dart';
import '../../shared/types/paginated_result.dart';

abstract class SuperAdminRepository {
  Future<Map<String, dynamic>> getStats();
  Future<PaginatedResult<Tenant>> getTenants({int? page});
  Future<Tenant> suspendTenant(String id);
  Future<Tenant> activateTenant(String id);
  Future<PaginatedResult<User>> getUsers({int? page});
}
```

```dart
// apps/admin-mobile/lib/domain/repositories/onboarding_repository.dart
import '../entities/tenant.dart';

abstract class OnboardingRepository {
  Future<({String token, Tenant tenant})> register({
    required String businessName, required String ownerName,
    required String email, required String password,
  });
  Future<void> verify(String code);
  Future<bool> checkSlug(String slug);
  Future<void> setBusinessType(String type, bool createServices);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-mobile/lib/domain/repositories/ apps/admin-mobile/lib/shared/types/
git commit -m "feat(admin-mobile): add domain repository interfaces"
```

---

## Task 5: Infrastructure — Dio Client & Storage

**Files:**
- Create: `apps/admin-mobile/lib/infrastructure/api/dio_client.dart`
- Create: `apps/admin-mobile/lib/infrastructure/storage/secure_storage.dart`
- Create: `apps/admin-mobile/lib/infrastructure/storage/preferences.dart`

- [ ] **Step 1: Create storage services**

```dart
// apps/admin-mobile/lib/infrastructure/storage/secure_storage.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  final _storage = const FlutterSecureStorage();

  Future<String?> getToken() => _storage.read(key: 'auth_token');
  Future<void> setToken(String token) => _storage.write(key: 'auth_token', value: token);
  Future<void> deleteToken() => _storage.delete(key: 'auth_token');
  Future<void> clear() => _storage.deleteAll();
}
```

```dart
// apps/admin-mobile/lib/infrastructure/storage/preferences.dart
import 'package:shared_preferences/shared_preferences.dart';

class PreferencesService {
  late SharedPreferences _prefs;

  Future<void> init() async { _prefs = await SharedPreferences.getInstance(); }

  String? get tenantSlug => _prefs.getString('tenant_slug');
  Future<void> setTenantSlug(String slug) => _prefs.setString('tenant_slug', slug);

  bool get isSuperAdmin => _prefs.getBool('is_super_admin') ?? false;
  Future<void> setIsSuperAdmin(bool val) => _prefs.setBool('is_super_admin', val);

  Future<void> clear() async {
    await _prefs.remove('tenant_slug');
    await _prefs.remove('is_super_admin');
  }
}
```

- [ ] **Step 2: Create Dio client**

```dart
// apps/admin-mobile/lib/infrastructure/api/dio_client.dart
import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';
import '../storage/preferences.dart';

class DioClient {
  final Dio dio;
  final SecureStorageService _secureStorage;
  final PreferencesService _preferences;

  DioClient({
    required SecureStorageService secureStorage,
    required PreferencesService preferences,
    String? baseUrl,
  }) : _secureStorage = secureStorage,
       _preferences = preferences,
       dio = Dio(BaseOptions(
         baseUrl: baseUrl ?? 'http://10.0.2.2:8000/api/v1',
         headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
         connectTimeout: const Duration(seconds: 15),
         receiveTimeout: const Duration(seconds: 15),
       )) {
    dio.interceptors.add(_authInterceptor());
    dio.interceptors.add(_errorInterceptor());
  }

  Interceptor _authInterceptor() => InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await _secureStorage.getToken();
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
      final slug = _preferences.tenantSlug;
      if (slug != null) options.headers['X-Tenant'] = slug;
      handler.next(options);
    },
  );

  Interceptor _errorInterceptor() => InterceptorsWrapper(
    onError: (error, handler) {
      if (error.response?.statusCode == 401) {
        _secureStorage.clear();
        _preferences.clear();
        // Navigation to login handled by BLoC listening to auth state
      }
      handler.next(error);
    },
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-mobile/lib/infrastructure/
git commit -m "feat(admin-mobile): add Dio client and storage services"
```

---

## Task 6: Infrastructure — API Repositories & Mappers

**Files:**
- Create: `apps/admin-mobile/lib/infrastructure/api/mappers/*.dart` (6 files)
- Create: `apps/admin-mobile/lib/infrastructure/api/repositories/*.dart` (12 files)

- [ ] **Step 1: Create mappers**

Each mapper is a function that converts `Map<String, dynamic>` (JSON) to domain entity. Same pattern as web but in Dart:

```dart
// apps/admin-mobile/lib/infrastructure/api/mappers/reservation_mapper.dart
import '../../../domain/entities/reservation.dart';

Reservation mapReservation(Map<String, dynamic> json) => Reservation(
  id: json['id'].toString(),
  clientId: json['client_id'].toString(),
  clientResourceId: json['client_resource_id'].toString(),
  serviceId: json['service_id'].toString(),
  assignedTo: json['assigned_to']?.toString(),
  scheduledAt: DateTime.parse(json['scheduled_at']),
  estimatedEnd: DateTime.parse(json['estimated_end']),
  status: ReservationStatusX.fromApi(json['status']),
  notes: json['notes'],
  cancelledAt: json['cancelled_at'] != null ? DateTime.parse(json['cancelled_at']) : null,
  cancelReason: json['cancel_reason'],
  createdBy: json['created_by'].toString(),
  createdAt: DateTime.parse(json['created_at']),
  clientResourcePlate: json['client_resource']?['plate'],
  clientResourceLabel: json['client_resource']?['label'],
  serviceName: json['service']?['name'],
  servicePrice: json['service']?['price']?.toString(),
  clientName: json['client']?['name'],
  clientEmail: json['client']?['email'],
);

AvailableSlot mapAvailableSlot(Map<String, dynamic> json) => AvailableSlot(
  start: DateTime.parse(json['start']),
  end: DateTime.parse(json['end']),
  available: json['available'],
);
```

Create similar mappers for: `service_mapper.dart`, `service_log_mapper.dart`, `client_resource_mapper.dart`, `user_mapper.dart`, `tenant_mapper.dart`. Each follows same JSON→Entity pattern.

- [ ] **Step 2: Create API repository implementations**

Each implements the domain interface using DioClient:

```dart
// apps/admin-mobile/lib/infrastructure/api/repositories/api_auth_repository.dart
import 'package:dio/dio.dart';
import '../../../domain/entities/user.dart';
import '../../../domain/entities/tenant.dart';
import '../../../domain/repositories/auth_repository.dart';
import '../mappers/user_mapper.dart';
import '../mappers/tenant_mapper.dart';
import '../dio_client.dart';

class ApiAuthRepository implements AuthRepository {
  final DioClient _client;
  ApiAuthRepository(this._client);

  @override
  Future<LoginResult> login(String email, String password) async {
    final response = await _client.dio.post('/auth/login', data: {'email': email, 'password': password});
    final d = response.data['data'];
    return LoginResult(
      user: mapUser(d['user']),
      token: d['token'],
      tenant: d['tenant'] != null ? mapTenant(d['tenant']) : null,
    );
  }

  @override
  Future<LoginResult> register({required String name, required String email, required String password}) async {
    final response = await _client.dio.post('/auth/register', data: {'name': name, 'email': email, 'password': password});
    final d = response.data['data'];
    return LoginResult(user: mapUser(d['user']), token: d['token'], tenant: d['tenant'] != null ? mapTenant(d['tenant']) : null);
  }

  @override
  Future<void> logout() async { await _client.dio.post('/auth/logout'); }

  @override
  Future<({User user, Tenant? tenant})> me() async {
    final response = await _client.dio.get('/auth/me');
    final d = response.data['data'];
    return (user: mapUser(d['user']), tenant: d['tenant'] != null ? mapTenant(d['tenant']) : null);
  }
}
```

Create remaining repositories following same pattern: `api_reservation_repository.dart`, `api_service_repository.dart`, `api_service_log_repository.dart`, `api_client_resource_repository.dart`, `api_user_repository.dart`, `api_tenant_repository.dart`, `api_report_repository.dart`, `api_availability_repository.dart`, `api_upload_repository.dart`, `api_super_admin_repository.dart`, `api_onboarding_repository.dart`.

Each does: dio call → map response → return domain type. Mirror exact patterns from web API repositories.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-mobile/lib/infrastructure/api/
git commit -m "feat(admin-mobile): add API repositories and mappers"
```

---

## Task 7: Infrastructure — Push & Camera Services

**Files:**
- Create: `apps/admin-mobile/lib/infrastructure/push/firebase_push_service.dart`
- Create: `apps/admin-mobile/lib/infrastructure/camera/camera_service.dart`

- [ ] **Step 1: Create push notification service**

```dart
// apps/admin-mobile/lib/infrastructure/push/firebase_push_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';

class FirebasePushService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  Future<void> init() async {
    final settings = await _messaging.requestPermission(alert: true, badge: true, sound: true);
    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      final token = await _messaging.getToken();
      // TODO: Send token to backend for this user
      print('FCM Token: $token');
    }

    FirebaseMessaging.onMessage.listen(_handleForeground);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleBackground);
  }

  Future<void> subscribeToTenant(String tenantId) async {
    await _messaging.subscribeToTopic('tenant_$tenantId');
  }

  Future<void> unsubscribeFromTenant(String tenantId) async {
    await _messaging.unsubscribeFromTopic('tenant_$tenantId');
  }

  void _handleForeground(RemoteMessage message) {
    // Show in-app notification banner
    // Handled by BLoC/listener in presentation layer
  }

  void _handleBackground(RemoteMessage message) {
    // Navigate to relevant page based on message data
    // Handled by router in presentation layer
  }
}
```

- [ ] **Step 2: Create camera service**

```dart
// apps/admin-mobile/lib/infrastructure/camera/camera_service.dart
import 'dart:io';
import 'package:image_picker/image_picker.dart';

class CameraService {
  final _picker = ImagePicker();

  Future<File?> pickImage({required ImageSource source, int maxWidth = 1080, int quality = 80}) async {
    final picked = await _picker.pickImage(source: source, maxWidth: maxWidth.toDouble(), imageQuality: quality);
    if (picked == null) return null;
    return File(picked.path);
  }

  Future<File?> showSourcePicker() async {
    // Default to gallery. Caller can show dialog to choose source.
    return pickImage(source: ImageSource.gallery);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-mobile/lib/infrastructure/push/ apps/admin-mobile/lib/infrastructure/camera/
git commit -m "feat(admin-mobile): add push notification and camera services"
```

---

## Task 8: Dependency Injection

**Files:**
- Create: `apps/admin-mobile/lib/injection.dart`

- [ ] **Step 1: Setup get_it**

```dart
// apps/admin-mobile/lib/injection.dart
import 'package:get_it/get_it.dart';
import 'infrastructure/storage/secure_storage.dart';
import 'infrastructure/storage/preferences.dart';
import 'infrastructure/api/dio_client.dart';
import 'infrastructure/push/firebase_push_service.dart';
import 'infrastructure/camera/camera_service.dart';
import 'infrastructure/api/repositories/api_auth_repository.dart';
import 'infrastructure/api/repositories/api_reservation_repository.dart';
import 'infrastructure/api/repositories/api_service_repository.dart';
import 'infrastructure/api/repositories/api_service_log_repository.dart';
import 'infrastructure/api/repositories/api_client_resource_repository.dart';
import 'infrastructure/api/repositories/api_user_repository.dart';
import 'infrastructure/api/repositories/api_tenant_repository.dart';
import 'infrastructure/api/repositories/api_report_repository.dart';
import 'infrastructure/api/repositories/api_availability_repository.dart';
import 'infrastructure/api/repositories/api_upload_repository.dart';
import 'infrastructure/api/repositories/api_super_admin_repository.dart';
import 'infrastructure/api/repositories/api_onboarding_repository.dart';
import 'domain/repositories/auth_repository.dart';
import 'domain/repositories/reservation_repository.dart';
import 'domain/repositories/service_repository.dart';
import 'domain/repositories/service_log_repository.dart';
import 'domain/repositories/client_resource_repository.dart';
import 'domain/repositories/user_repository.dart';
import 'domain/repositories/tenant_repository.dart';
import 'domain/repositories/report_repository.dart';
import 'domain/repositories/availability_repository.dart';
import 'domain/repositories/upload_repository.dart';
import 'domain/repositories/super_admin_repository.dart';
import 'domain/repositories/onboarding_repository.dart';

final sl = GetIt.instance;

Future<void> initDependencies() async {
  // Storage
  sl.registerLazySingleton(() => SecureStorageService());
  sl.registerLazySingleton(() => PreferencesService());
  await sl<PreferencesService>().init();

  // API Client
  sl.registerLazySingleton(() => DioClient(secureStorage: sl(), preferences: sl()));

  // Services
  sl.registerLazySingleton(() => FirebasePushService());
  sl.registerLazySingleton(() => CameraService());

  // Repositories
  sl.registerLazySingleton<AuthRepository>(() => ApiAuthRepository(sl()));
  sl.registerLazySingleton<ReservationRepository>(() => ApiReservationRepository(sl()));
  sl.registerLazySingleton<ServiceRepository>(() => ApiServiceRepository(sl()));
  sl.registerLazySingleton<ServiceLogRepository>(() => ApiServiceLogRepository(sl()));
  sl.registerLazySingleton<ClientResourceRepository>(() => ApiClientResourceRepository(sl()));
  sl.registerLazySingleton<UserRepository>(() => ApiUserRepository(sl()));
  sl.registerLazySingleton<TenantRepository>(() => ApiTenantRepository(sl()));
  sl.registerLazySingleton<ReportRepository>(() => ApiReportRepository(sl()));
  sl.registerLazySingleton<AvailabilityRepository>(() => ApiAvailabilityRepository(sl()));
  sl.registerLazySingleton<UploadRepository>(() => ApiUploadRepository(sl()));
  sl.registerLazySingleton<SuperAdminRepository>(() => ApiSuperAdminRepository(sl()));
  sl.registerLazySingleton<OnboardingRepository>(() => ApiOnboardingRepository(sl()));
}
```

- [ ] **Step 2: Update main.dart**

```dart
// apps/admin-mobile/lib/main.dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'injection.dart';
import 'presentation/app/theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  await initDependencies();
  runApp(const TurnlyApp());
}

class TurnlyApp extends StatelessWidget {
  const TurnlyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Turnly Admin',
      theme: AppTheme.light,
      home: const Scaffold(body: Center(child: Text('Turnly Admin'))),
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-mobile/lib/
git commit -m "feat(admin-mobile): add dependency injection with get_it"
```

---

## Task 9: Application Layer — Use Cases

**Files:**
- Create: `apps/admin-mobile/lib/application/use_cases/**/*.dart` (all use cases)

- [ ] **Step 1: Create use cases**

Each use case follows the pattern:

```dart
// apps/admin-mobile/lib/application/use_cases/auth/login_use_case.dart
import '../../../domain/repositories/auth_repository.dart';

class LoginUseCase {
  final AuthRepository _repo;
  LoginUseCase(this._repo);
  Future<LoginResult> call(String email, String password) => _repo.login(email, password);
}
```

Create all use cases mirroring web:
- **auth/**: LoginUseCase, LogoutUseCase, GetMeUseCase, RegisterUseCase
- **reservations/**: GetReservationsUseCase, GetReservationUseCase, CreateReservationUseCase, TransitionReservationUseCase, CancelReservationUseCase, GetAvailableSlotsUseCase
- **services/**: GetServicesUseCase, CreateServiceUseCase, UpdateServiceUseCase, DeleteServiceUseCase
- **service_logs/**: GetServiceLogsUseCase, CreateServiceLogUseCase, UpdateServiceLogUseCase, DeleteServiceLogUseCase, CompleteServiceLogUseCase, GetDailySummaryUseCase
- **clients/**: GetClientsUseCase, GetClientUseCase, CreateClientUseCase, UpdateClientUseCase, GetClientHistoryUseCase
- **team/**: GetTeamUseCase, InviteUserUseCase, ChangeRoleUseCase
- **reports/**: GetRangeReportUseCase, GetDailyReportUseCase
- **settings/**: GetSettingsUseCase, UpdateSettingsUseCase

Each: class with constructor(repo) and call() method.

- [ ] **Step 2: Commit**

```bash
git add apps/admin-mobile/lib/application/use_cases/
git commit -m "feat(admin-mobile): add application use cases"
```

---

## Task 10: Application Layer — BLoCs

**Files:**
- Create: `apps/admin-mobile/lib/application/blocs/auth/auth_bloc.dart`
- Create: `apps/admin-mobile/lib/application/blocs/auth/auth_event.dart`
- Create: `apps/admin-mobile/lib/application/blocs/auth/auth_state.dart`
- Create: `apps/admin-mobile/lib/application/blocs/reservations/reservations_bloc.dart` (+ event + state)
- Create similar for: dashboard, services, service_logs, clients, team, reports, settings, super_admin

- [ ] **Step 1: Create auth BLoC**

```dart
// apps/admin-mobile/lib/application/blocs/auth/auth_event.dart
import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

class LoginRequested extends AuthEvent {
  final String email;
  final String password;
  LoginRequested({required this.email, required this.password});
  @override
  List<Object?> get props => [email, password];
}

class LogoutRequested extends AuthEvent {}
class CheckAuthRequested extends AuthEvent {}
```

```dart
// apps/admin-mobile/lib/application/blocs/auth/auth_state.dart
import 'package:equatable/equatable.dart';
import '../../../domain/entities/user.dart';
import '../../../domain/entities/tenant.dart';

abstract class AuthState extends Equatable {
  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {}
class AuthLoading extends AuthState {}
class AuthAuthenticated extends AuthState {
  final User user;
  final Tenant? tenant;
  AuthAuthenticated({required this.user, this.tenant});
  @override
  List<Object?> get props => [user, tenant];
}
class AuthUnauthenticated extends AuthState {}
class AuthError extends AuthState {
  final String message;
  AuthError(this.message);
  @override
  List<Object?> get props => [message];
}
```

```dart
// apps/admin-mobile/lib/application/blocs/auth/auth_bloc.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import 'auth_event.dart';
import 'auth_state.dart';
import '../../use_cases/auth/login_use_case.dart';
import '../../use_cases/auth/logout_use_case.dart';
import '../../use_cases/auth/get_me_use_case.dart';
import '../../../infrastructure/storage/secure_storage.dart';
import '../../../infrastructure/storage/preferences.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final LoginUseCase _login;
  final LogoutUseCase _logout;
  final GetMeUseCase _getMe;
  final SecureStorageService _secureStorage;
  final PreferencesService _preferences;

  AuthBloc({
    required LoginUseCase login, required LogoutUseCase logout,
    required GetMeUseCase getMe, required SecureStorageService secureStorage,
    required PreferencesService preferences,
  }) : _login = login, _logout = logout, _getMe = getMe,
       _secureStorage = secureStorage, _preferences = preferences,
       super(AuthInitial()) {
    on<LoginRequested>(_onLogin);
    on<LogoutRequested>(_onLogout);
    on<CheckAuthRequested>(_onCheckAuth);
  }

  Future<void> _onLogin(LoginRequested event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final result = await _login(event.email, event.password);
      await _secureStorage.setToken(result.token);
      if (result.tenant != null) await _preferences.setTenantSlug(result.tenant!.slug);
      await _preferences.setIsSuperAdmin(result.user.isSuperAdmin);
      emit(AuthAuthenticated(user: result.user, tenant: result.tenant));
    } catch (e) {
      emit(AuthError(e.toString()));
    }
  }

  Future<void> _onLogout(LogoutRequested event, Emitter<AuthState> emit) async {
    try { await _logout(); } catch (_) {}
    await _secureStorage.clear();
    await _preferences.clear();
    emit(AuthUnauthenticated());
  }

  Future<void> _onCheckAuth(CheckAuthRequested event, Emitter<AuthState> emit) async {
    final token = await _secureStorage.getToken();
    if (token == null) { emit(AuthUnauthenticated()); return; }
    try {
      final result = await _getMe();
      emit(AuthAuthenticated(user: result.user, tenant: result.tenant));
    } catch (_) {
      emit(AuthUnauthenticated());
    }
  }
}
```

- [ ] **Step 2: Create reservations BLoC**

```dart
// apps/admin-mobile/lib/application/blocs/reservations/reservations_event.dart
import 'package:equatable/equatable.dart';
import '../../../domain/entities/reservation.dart';

abstract class ReservationsEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

class LoadReservations extends ReservationsEvent {
  final ReservationFilters filters;
  LoadReservations(this.filters);
  @override
  List<Object?> get props => [filters];
}

class TransitionReservation extends ReservationsEvent {
  final String id;
  final ReservationAction action;
  TransitionReservation({required this.id, required this.action});
  @override
  List<Object?> get props => [id, action];
}

class CancelReservation extends ReservationsEvent {
  final String id;
  final String reason;
  CancelReservation({required this.id, required this.reason});
  @override
  List<Object?> get props => [id, reason];
}
```

```dart
// apps/admin-mobile/lib/application/blocs/reservations/reservations_state.dart
import 'package:equatable/equatable.dart';
import '../../../domain/entities/reservation.dart';
import '../../../shared/types/paginated_result.dart';

abstract class ReservationsState extends Equatable {
  @override
  List<Object?> get props => [];
}

class ReservationsInitial extends ReservationsState {}
class ReservationsLoading extends ReservationsState {}
class ReservationsLoaded extends ReservationsState {
  final PaginatedResult<Reservation> result;
  ReservationsLoaded(this.result);
  @override
  List<Object?> get props => [result];
}
class ReservationsError extends ReservationsState {
  final String message;
  ReservationsError(this.message);
  @override
  List<Object?> get props => [message];
}
```

```dart
// apps/admin-mobile/lib/application/blocs/reservations/reservations_bloc.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import 'reservations_event.dart';
import 'reservations_state.dart';
import '../../use_cases/reservations/get_reservations_use_case.dart';
import '../../use_cases/reservations/transition_reservation_use_case.dart';
import '../../use_cases/reservations/cancel_reservation_use_case.dart';

class ReservationsBloc extends Bloc<ReservationsEvent, ReservationsState> {
  final GetReservationsUseCase _getReservations;
  final TransitionReservationUseCase _transition;
  final CancelReservationUseCase _cancel;

  ReservationsBloc({
    required GetReservationsUseCase getReservations,
    required TransitionReservationUseCase transition,
    required CancelReservationUseCase cancel,
  }) : _getReservations = getReservations, _transition = transition, _cancel = cancel,
       super(ReservationsInitial()) {
    on<LoadReservations>(_onLoad);
    on<TransitionReservation>(_onTransition);
    on<CancelReservation>(_onCancel);
  }

  Future<void> _onLoad(LoadReservations event, Emitter<ReservationsState> emit) async {
    emit(ReservationsLoading());
    try {
      final result = await _getReservations(event.filters);
      emit(ReservationsLoaded(result));
    } catch (e) {
      emit(ReservationsError(e.toString()));
    }
  }

  Future<void> _onTransition(TransitionReservation event, Emitter<ReservationsState> emit) async {
    try {
      await _transition(event.id, event.action);
      // Reload current list
      if (state is ReservationsLoaded) {
        add(LoadReservations(const ReservationFilters()));
      }
    } catch (e) {
      emit(ReservationsError(e.toString()));
    }
  }

  Future<void> _onCancel(CancelReservation event, Emitter<ReservationsState> emit) async {
    try {
      await _cancel(event.id, event.reason);
      if (state is ReservationsLoaded) {
        add(LoadReservations(const ReservationFilters()));
      }
    } catch (e) {
      emit(ReservationsError(e.toString()));
    }
  }
}
```

- [ ] **Step 3: Create remaining BLoCs following same pattern**

Create for: DashboardBloc, ServicesBloc, ServiceLogsBloc, ClientsBloc, TeamBloc, ReportsBloc, SettingsBloc, SuperAdminBloc. Each has event/state/bloc files following same structure.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-mobile/lib/application/blocs/
git commit -m "feat(admin-mobile): add BLoCs for all domains"
```

---

## Task 11: Presentation — Router & App Shell

**Files:**
- Create: `apps/admin-mobile/lib/presentation/app/router.dart`
- Create: `apps/admin-mobile/lib/presentation/layout/app_shell.dart`
- Create: `apps/admin-mobile/lib/presentation/layout/bottom_nav_bar.dart`
- Modify: `apps/admin-mobile/lib/main.dart`

- [ ] **Step 1: Create router with GoRouter**

```dart
// apps/admin-mobile/lib/presentation/app/router.dart
import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';
import '../pages/auth/login_page.dart';
import '../pages/auth/register_page.dart';
import '../pages/dashboard/dashboard_page.dart';
import '../pages/reservations/reservations_page.dart';
import '../pages/service_logs/service_log_page.dart';
import '../pages/reports/reports_page.dart';
import '../layout/app_shell.dart';

final router = GoRouter(
  initialLocation: '/login',
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
    GoRoute(path: '/register', builder: (_, __) => const RegisterPage()),
    ShellRoute(
      builder: (_, state, child) => AppShell(child: child),
      routes: [
        GoRoute(path: '/dashboard', builder: (_, __) => const DashboardPage()),
        GoRoute(path: '/reservations', builder: (_, __) => const ReservationsPage()),
        GoRoute(path: '/service-logs', builder: (_, __) => const ServiceLogPage()),
        GoRoute(path: '/reports', builder: (_, __) => const ReportsPage()),
        // More routes added as pages are built
      ],
    ),
  ],
);
```

- [ ] **Step 2: Create bottom nav bar**

```dart
// apps/admin-mobile/lib/presentation/layout/bottom_nav_bar.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

class AppBottomNavBar extends StatelessWidget {
  final int currentIndex;
  const AppBottomNavBar({super.key, required this.currentIndex});

  @override
  Widget build(BuildContext context) {
    return BottomNavigationBar(
      currentIndex: currentIndex,
      onTap: (i) => _onTap(context, i),
      items: const [
        BottomNavigationBarItem(icon: Icon(LucideIcons.home), label: 'Home'),
        BottomNavigationBarItem(icon: Icon(LucideIcons.calendar), label: 'Reservas'),
        BottomNavigationBarItem(icon: Icon(LucideIcons.plusCircle), label: 'Nuevo'),
        BottomNavigationBarItem(icon: Icon(LucideIcons.barChart3), label: 'Reportes'),
        BottomNavigationBarItem(icon: Icon(LucideIcons.moreHorizontal), label: 'Más'),
      ],
    );
  }

  void _onTap(BuildContext context, int index) {
    switch (index) {
      case 0: context.go('/dashboard');
      case 1: context.go('/reservations');
      case 2: _showQuickActions(context);
      case 3: context.go('/reports');
      case 4: _showMoreSheet(context);
    }
  }

  void _showQuickActions(BuildContext context) {
    showModalBottomSheet(context: context, builder: (_) => const _QuickActionsSheet());
  }

  void _showMoreSheet(BuildContext context) {
    showModalBottomSheet(context: context, builder: (_) => const _MoreSheet());
  }
}

class _QuickActionsSheet extends StatelessWidget {
  const _QuickActionsSheet();
  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(leading: const Icon(LucideIcons.calendar), title: const Text('Nueva Reserva'), onTap: () { Navigator.pop(context); context.push('/reservations/create'); }),
        ListTile(leading: const Icon(LucideIcons.clipboardList), title: const Text('Registrar Servicio'), onTap: () { Navigator.pop(context); context.push('/service-logs/new'); }),
        ListTile(leading: const Icon(LucideIcons.clock), title: const Text('Bloquear Horario'), onTap: () { Navigator.pop(context); }),
      ]),
    );
  }
}

class _MoreSheet extends StatelessWidget {
  const _MoreSheet();
  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(leading: const Icon(LucideIcons.users), title: const Text('Clientes'), onTap: () { Navigator.pop(context); context.push('/clients'); }),
        ListTile(leading: const Icon(LucideIcons.scissors), title: const Text('Servicios'), onTap: () { Navigator.pop(context); context.push('/services'); }),
        ListTile(leading: const Icon(LucideIcons.userPlus), title: const Text('Equipo'), onTap: () { Navigator.pop(context); context.push('/team'); }),
        ListTile(leading: const Icon(LucideIcons.settings), title: const Text('Configuración'), onTap: () { Navigator.pop(context); context.push('/settings'); }),
      ]),
    );
  }
}
```

- [ ] **Step 3: Create app shell**

```dart
// apps/admin-mobile/lib/presentation/layout/app_shell.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'bottom_nav_bar.dart';

class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    if (location.startsWith('/dashboard')) return 0;
    if (location.startsWith('/reservations')) return 1;
    if (location.startsWith('/reports')) return 3;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: AppBottomNavBar(currentIndex: _currentIndex(context)),
    );
  }
}
```

- [ ] **Step 4: Update main.dart with router and BLoC providers**

```dart
// apps/admin-mobile/lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:firebase_core/firebase_core.dart';
import 'injection.dart';
import 'presentation/app/theme.dart';
import 'presentation/app/router.dart';
import 'application/blocs/auth/auth_bloc.dart';
import 'application/use_cases/auth/login_use_case.dart';
import 'application/use_cases/auth/logout_use_case.dart';
import 'application/use_cases/auth/get_me_use_case.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  await initDependencies();
  runApp(const TurnlyApp());
}

class TurnlyApp extends StatelessWidget {
  const TurnlyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => AuthBloc(
          login: LoginUseCase(sl()),
          logout: LogoutUseCase(sl()),
          getMe: GetMeUseCase(sl()),
          secureStorage: sl(),
          preferences: sl(),
        )..add(CheckAuthRequested())),
      ],
      child: MaterialApp.router(
        title: 'Turnly Admin',
        theme: AppTheme.light,
        routerConfig: router,
      ),
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin-mobile/lib/
git commit -m "feat(admin-mobile): add GoRouter, app shell, and bottom navigation"
```

---

## Tasks 12-22: Presentation Pages

From this point, each task builds a specific page. Pattern for each:

1. Create page widget in `presentation/pages/{domain}/`
2. Create feature widgets in same directory or `presentation/widgets/`
3. Wire to BLoC (BlocProvider + BlocBuilder)
4. Pull-to-refresh on lists
5. Shimmer skeleton loading states
6. Commit

### Task 12: Auth Pages (Login + Register)
Build LoginPage and RegisterPage with form validation, BLoC integration, navigation on success.

### Task 13: Dashboard Page
Build DashboardPage with greeting, revenue cards (horizontal scroll), live tracker widget, quick actions, upcoming reservations. Pull-to-refresh.

### Task 14: Reservations Page + Detail
Build ReservationsPage with timeline view, filter chips, date selector. ReservationDetailPage with status actions, swipe gestures on cards.

### Task 15: Create Reservation Page
Multi-step full screen: service cards → date picker → slot grid → client search → confirm.

### Task 16: Service Log Page
Build ServiceLogPage with summary card, log list, date navigation. NewServiceLogPage full screen form.

### Task 17: Clients Page + Detail
Build ClientsPage with adaptive cards, search. ClientDetailPage with stats + history tabs.

### Task 18: Services Page
Build ServicesPage with 2-column grid, toggle active, image upload via camera service.

### Task 19: Team Page
Build TeamPage with staff cards, role change, invite bottom sheet.

### Task 20: Reports Page
Build ReportsPage with preset chips, stat cards, fl_chart area + donut charts, breakdown table.

### Task 21: Settings Page
Build SettingsPage with category list → sub-pages for each tab (General, Schedule, Gallery, Custom Fields, Permissions, Brand).

### Task 22: Super Admin Pages + Onboarding + Polish
Build SuperAdmin pages (dashboard, tenants, users). Add onboarding banner. Add page transitions, shimmer skeletons, error/empty states.

- [ ] **Each task: implement → test on device/emulator → commit**

```bash
# Pattern for each task commit:
git add apps/admin-mobile/lib/
git commit -m "feat(admin-mobile): add [page/feature name]"
```

---

## Execution Notes

- Tasks 1-11 are foundational and MUST be completed in order
- Tasks 12-22 can be partially parallelized after Task 11 (all depend on router + BLoCs being ready)
- Test on both iOS simulator and Android emulator throughout
- Firebase setup requires `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) — configure separately
- Use `10.0.2.2` for Android emulator localhost, `localhost` for iOS simulator
