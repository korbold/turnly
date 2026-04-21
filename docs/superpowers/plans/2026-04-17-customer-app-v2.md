# Customer App V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new Flutter customer app with modern UI/UX, dynamic per-business theming, and BLoC/Cubit state management.

**Architecture:** Clean Architecture with feature-based folders. Each feature has data/ (repos impl, DTOs), domain/ (entities, repo interfaces), and presentation/ (cubits, screens, widgets). DI via get_it + injectable. Routing via go_router.

**Tech Stack:** Flutter 3.x, flutter_bloc, get_it, injectable, go_router, dio, fpdart, hive_flutter, flutter_secure_storage, flutter_animate, shimmer, cached_network_image

**Spec:** `docs/superpowers/specs/2026-04-17-customer-app-v2-design.md`

**Existing app reference:** `apps/customer/` (copy domain logic, rewrite everything else)

---

## Phase 1: Project Setup & Core Infrastructure

### Task 1: Create Flutter project and configure dependencies

**Files:**
- Create: `apps/customer_v2/pubspec.yaml`
- Create: `apps/customer_v2/lib/main.dart`
- Create: `apps/customer_v2/analysis_options.yaml`

- [ ] **Step 1: Create Flutter project**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps
flutter create customer_v2 --org com.turnly --platforms android,ios
```

- [ ] **Step 2: Replace pubspec.yaml dependencies**

Replace the dependencies section in `apps/customer_v2/pubspec.yaml`:

```yaml
name: customer_v2
description: Turnly Customer App V2
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: ^3.8.0

dependencies:
  flutter:
    sdk: flutter

  # State management
  flutter_bloc: ^9.0.0
  equatable: ^2.0.7

  # DI
  get_it: ^8.0.0
  injectable: ^2.5.0

  # Navigation
  go_router: ^14.8.0

  # Network
  dio: ^5.7.0

  # Functional
  fpdart: ^1.1.0

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
  cupertino_icons: ^1.0.8
  google_fonts: ^6.2.1

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0
  injectable_generator: ^2.6.0
  build_runner: ^2.4.0

flutter:
  uses-material-design: true
```

- [ ] **Step 3: Install dependencies**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/customer_v2
flutter pub get
```

- [ ] **Step 4: Create minimal main.dart**

```dart
import 'package:flutter/material.dart';

void main() {
  runApp(const MaterialApp(
    home: Scaffold(body: Center(child: Text('Turnly V2'))),
  ));
}
```

- [ ] **Step 5: Verify project runs**

```bash
flutter run -d chrome --web-port=8080
```
Expected: App launches showing "Turnly V2"

- [ ] **Step 6: Commit**

```bash
git add apps/customer_v2/
git commit -m "feat(customer-v2): scaffold Flutter project with dependencies"
```

---

### Task 2: Core error handling

**Files:**
- Create: `lib/core/error/failures.dart`
- Create: `lib/core/error/exceptions.dart`

All paths below are relative to `apps/customer_v2/`.

- [ ] **Step 1: Create failures.dart**

```dart
// lib/core/error/failures.dart
import 'package:equatable/equatable.dart';

sealed class Failure extends Equatable {
  const Failure(this.message);
  final String message;

  @override
  List<Object?> get props => [message];
}

class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'Sin conexión a internet']);
}

class ServerFailure extends Failure {
  const ServerFailure(super.message, {this.code});
  final String? code;

  @override
  List<Object?> get props => [message, code];
}

class AuthFailure extends Failure {
  const AuthFailure([super.message = 'Sesión expirada']);
}

class NotFoundFailure extends Failure {
  const NotFoundFailure([super.message = 'Recurso no encontrado']);
}

class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Error de almacenamiento local']);
}
```

- [ ] **Step 2: Create exceptions.dart**

```dart
// lib/core/error/exceptions.dart
class ServerException implements Exception {
  final String message;
  final int? statusCode;

  const ServerException({required this.message, this.statusCode});
}

class AuthException implements Exception {
  final String message;
  const AuthException([this.message = 'Authentication failed']);
}

class NetworkException implements Exception {
  final String message;
  const NetworkException([this.message = 'No internet connection']);
}

class CacheException implements Exception {
  final String message;
  const CacheException([this.message = 'Cache error']);
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/core/error/
git commit -m "feat(customer-v2): add error handling (failures + exceptions)"
```

---

### Task 3: Secure storage

**Files:**
- Create: `lib/core/storage/secure_storage.dart`

- [ ] **Step 1: Create secure_storage.dart**

```dart
// lib/core/storage/secure_storage.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const _storage = FlutterSecureStorage();

  static const _tokenKey = 'auth_token';
  static const _tenantSlugKey = 'tenant_slug';

  // Token
  static Future<void> saveToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  static Future<String?> getToken() =>
      _storage.read(key: _tokenKey);

  static Future<void> deleteToken() =>
      _storage.delete(key: _tokenKey);

  // Tenant
  static Future<void> saveTenantSlug(String slug) =>
      _storage.write(key: _tenantSlugKey, value: slug);

  static Future<String?> getTenantSlug() =>
      _storage.read(key: _tenantSlugKey);

  // Clear all
  static Future<void> clear() => _storage.deleteAll();
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/core/storage/
git commit -m "feat(customer-v2): add secure storage for auth tokens"
```

---

### Task 4: Dio HTTP client with interceptors

**Files:**
- Create: `lib/core/network/api_client.dart`
- Create: `lib/core/network/auth_interceptor.dart`
- Create: `lib/core/network/tenant_interceptor.dart`

- [ ] **Step 1: Create auth_interceptor.dart**

```dart
// lib/core/network/auth_interceptor.dart
import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';

class AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await SecureStorage.getToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      await SecureStorage.deleteToken();
    }
    handler.next(err);
  }
}
```

- [ ] **Step 2: Create tenant_interceptor.dart**

```dart
// lib/core/network/tenant_interceptor.dart
import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';

class TenantInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final slug = await SecureStorage.getTenantSlug();
    if (slug != null) {
      options.headers['X-Tenant'] = slug;
    }
    handler.next(options);
  }
}
```

- [ ] **Step 3: Create api_client.dart**

```dart
// lib/core/network/api_client.dart
import 'package:dio/dio.dart';
import 'auth_interceptor.dart';
import 'tenant_interceptor.dart';

class ApiClient {
  static Dio? _instance;

  static const String baseUrl = 'http://192.168.1.7:8000/api/v1';

  static Dio get instance {
    _instance ??= _createDio();
    return _instance!;
  }

  static Dio _createDio() {
    final dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    dio.interceptors.addAll([
      AuthInterceptor(),
      TenantInterceptor(),
    ]);

    return dio;
  }

  /// Reset instance (useful for testing or logout)
  static void reset() {
    _instance = null;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/core/network/
git commit -m "feat(customer-v2): add Dio HTTP client with auth/tenant interceptors"
```

---

### Task 5: Theme system — base theme + tenant themes

**Files:**
- Create: `lib/app/theme/app_colors.dart`
- Create: `lib/app/theme/app_theme.dart`
- Create: `lib/app/theme/app_typography.dart`
- Create: `lib/app/theme/tenant_theme.dart`

- [ ] **Step 1: Create app_colors.dart**

```dart
// lib/app/theme/app_colors.dart
import 'package:flutter/material.dart';

class AppColors {
  // Base neutral palette
  static const background = Color(0xFFF8F9FB);
  static const surface = Color(0xFFFFFFFF);
  static const textPrimary = Color(0xFF1A1D26);
  static const textSecondary = Color(0xFF6B7280);
  static const textTertiary = Color(0xFF9CA3AF);
  static const border = Color(0xFFE5E7EB);
  static const divider = Color(0xFFF3F4F6);

  // Status colors
  static const success = Color(0xFF10B981);
  static const warning = Color(0xFFF59E0B);
  static const error = Color(0xFFEF4444);
  static const info = Color(0xFF3B82F6);

  // Default accent (used when no tenant theme)
  static const accent = Color(0xFF6366F1);
  static const accentLight = Color(0xFFEEF2FF);
}
```

- [ ] **Step 2: Create app_typography.dart**

```dart
// lib/app/theme/app_typography.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTypography {
  static TextTheme get textTheme {
    return GoogleFonts.interTextTheme(const TextTheme(
      headlineLarge: TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
        height: 1.2,
      ),
      headlineMedium: TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
        height: 1.3,
      ),
      headlineSmall: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
        height: 1.3,
      ),
      titleLarge: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
      titleMedium: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
      bodyLarge: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: AppColors.textPrimary,
      ),
      bodyMedium: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: AppColors.textSecondary,
      ),
      bodySmall: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: AppColors.textTertiary,
      ),
      labelLarge: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
      labelMedium: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AppColors.textSecondary,
      ),
    ));
  }
}
```

- [ ] **Step 3: Create app_theme.dart**

```dart
// lib/app/theme/app_theme.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_colors.dart';
import 'app_typography.dart';

class AppTheme {
  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: AppTypography.textTheme,
      colorScheme: ColorScheme.light(
        primary: AppColors.accent,
        onPrimary: Colors.white,
        secondary: AppColors.accentLight,
        surface: AppColors.surface,
        error: AppColors.error,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.accent, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.accent,
        unselectedItemColor: AppColors.textTertiary,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
    );
  }
}
```

- [ ] **Step 4: Create tenant_theme.dart**

```dart
// lib/app/theme/tenant_theme.dart
import 'package:flutter/material.dart';

class TenantTheme {
  final Color primary;
  final Color secondary;
  final Color accent;

  const TenantTheme({
    required this.primary,
    required this.secondary,
    required this.accent,
  });

  /// Default palettes by business type
  static const Map<String, TenantTheme> defaults = {
    'car_wash': TenantTheme(
      primary: Color(0xFF0EA5E9),
      secondary: Color(0xFFE0F2FE),
      accent: Color(0xFF0284C7),
    ),
    'barbershop': TenantTheme(
      primary: Color(0xFF1E293B),
      secondary: Color(0xFFF1F5F9),
      accent: Color(0xFFF59E0B),
    ),
    'spa': TenantTheme(
      primary: Color(0xFFA78BFA),
      secondary: Color(0xFFEDE9FE),
      accent: Color(0xFF7C3AED),
    ),
    'gym': TenantTheme(
      primary: Color(0xFF10B981),
      secondary: Color(0xFFD1FAE5),
      accent: Color(0xFF059669),
    ),
    'medical': TenantTheme(
      primary: Color(0xFF06B6D4),
      secondary: Color(0xFFCFFAFE),
      accent: Color(0xFF0891B2),
    ),
  };

  static const TenantTheme fallback = TenantTheme(
    primary: Color(0xFF6366F1),
    secondary: Color(0xFFEEF2FF),
    accent: Color(0xFF4F46E5),
  );

  /// Resolve theme from business type string
  static TenantTheme fromBusinessType(String? type) {
    if (type == null) return fallback;
    return defaults[type] ?? fallback;
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/app/theme/
git commit -m "feat(customer-v2): add theme system with base + dynamic tenant themes"
```

---

### Task 6: Dependency injection setup

**Files:**
- Create: `lib/core/di/injection.dart`
- Create: `lib/core/di/injection.config.dart` (generated)

- [ ] **Step 1: Create injection.dart**

```dart
// lib/core/di/injection.dart
import 'package:get_it/get_it.dart';
import 'package:dio/dio.dart';
import '../network/api_client.dart';

final getIt = GetIt.instance;

void configureDependencies() {
  // Network
  getIt.registerLazySingleton<Dio>(() => ApiClient.instance);

  // Repositories will be registered as features are added
}
```

Note: We start with manual DI. injectable code gen can be added later if needed. Keeping it simple for now.

- [ ] **Step 2: Commit**

```bash
git add lib/core/di/
git commit -m "feat(customer-v2): add get_it dependency injection setup"
```

---

### Task 7: App router with auth guard

**Files:**
- Create: `lib/app/router.dart`

- [ ] **Step 1: Create router.dart**

```dart
// lib/app/router.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/storage/secure_storage.dart';
import '../features/onboarding/presentation/screens/onboarding_screen.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/register_screen.dart';
import '../features/home/presentation/screens/main_shell.dart';
import '../features/explore/presentation/screens/explore_screen.dart';
import '../features/business/presentation/screens/business_detail_screen.dart';
import '../features/reservations/presentation/screens/reservations_screen.dart';
import '../features/reservations/presentation/screens/create_reservation_screen.dart';
import '../features/reservations/presentation/screens/reservation_detail_screen.dart';
import '../features/profile/presentation/screens/profile_screen.dart';
import '../features/resources/presentation/screens/resources_screen.dart';
import '../features/resources/presentation/screens/add_resource_screen.dart';
import '../features/resources/presentation/screens/resource_history_screen.dart';
import '../features/favorites/presentation/screens/favorites_screen.dart';
import '../features/notifications/presentation/screens/notifications_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

final appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/login',
  redirect: (context, state) async {
    final token = await SecureStorage.getToken();
    final isAuthenticated = token != null;
    final isAuthRoute = state.matchedLocation == '/login' ||
        state.matchedLocation == '/register' ||
        state.matchedLocation == '/onboarding';

    if (!isAuthenticated && !isAuthRoute) return '/login';
    if (isAuthenticated && isAuthRoute) return '/home';
    return null;
  },
  routes: [
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) => const RegisterScreen(),
    ),

    // Main app shell with bottom nav
    ShellRoute(
      navigatorKey: _shellNavigatorKey,
      builder: (context, state, child) => MainShell(child: child),
      routes: [
        GoRoute(
          path: '/home',
          pageBuilder: (context, state) => const NoTransitionPage(
            child: ExploreScreen(),
          ),
        ),
        GoRoute(
          path: '/reservations',
          pageBuilder: (context, state) => const NoTransitionPage(
            child: ReservationsScreen(),
          ),
        ),
        GoRoute(
          path: '/profile',
          pageBuilder: (context, state) => const NoTransitionPage(
            child: ProfileScreen(),
          ),
        ),
      ],
    ),

    // Full-screen routes (outside shell)
    GoRoute(
      path: '/business/:slug',
      builder: (context, state) => BusinessDetailScreen(
        slug: state.pathParameters['slug']!,
      ),
    ),
    GoRoute(
      path: '/reservations/create',
      builder: (context, state) {
        final extra = state.extra as Map<String, dynamic>?;
        return CreateReservationScreen(
          tenantSlug: extra?['tenantSlug'] as String? ?? '',
          serviceId: extra?['serviceId'] as String?,
        );
      },
    ),
    GoRoute(
      path: '/reservations/:id',
      builder: (context, state) => ReservationDetailScreen(
        reservationId: state.pathParameters['id']!,
      ),
    ),
    GoRoute(
      path: '/resources',
      builder: (context, state) => const ResourcesScreen(),
    ),
    GoRoute(
      path: '/resources/add',
      builder: (context, state) => const AddResourceScreen(),
    ),
    GoRoute(
      path: '/resources/:id/history',
      builder: (context, state) => ResourceHistoryScreen(
        resourceId: state.pathParameters['id']!,
        label: state.extra as String? ?? '',
      ),
    ),
    GoRoute(
      path: '/favorites',
      builder: (context, state) => const FavoritesScreen(),
    ),
    GoRoute(
      path: '/notifications',
      builder: (context, state) => const NotificationsScreen(),
    ),
  ],
);
```

Note: Screen classes don't exist yet. They'll be created as placeholder stubs in the next tasks, then fleshed out in later phases.

- [ ] **Step 2: Commit**

```bash
git add lib/app/
git commit -m "feat(customer-v2): add GoRouter with auth guard and shell navigation"
```

---

### Task 8: App entry point and main.dart

**Files:**
- Modify: `lib/main.dart`

- [ ] **Step 1: Update main.dart**

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app/router.dart';
import 'app/theme/app_theme.dart';
import 'core/di/injection.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock to portrait
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  // Init Hive for local storage (favorites, etc.)
  await Hive.initFlutter();

  // Init Spanish date formatting
  await initializeDateFormatting('es');

  // Configure DI
  configureDependencies();

  runApp(const TurnlyApp());
}

class TurnlyApp extends StatelessWidget {
  const TurnlyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Turnly',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: appRouter,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/main.dart
git commit -m "feat(customer-v2): configure app entry point with Hive, DI, theming"
```

---

## Phase 2: Domain Layer (Entities + Repository Interfaces)

### Task 9: Auth domain

**Files:**
- Create: `lib/features/auth/domain/entities/user.dart`
- Create: `lib/features/auth/domain/repositories/auth_repository.dart`

- [ ] **Step 1: Create user entity**

```dart
// lib/features/auth/domain/entities/user.dart
import 'package:equatable/equatable.dart';

class User extends Equatable {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool isSuperAdmin;

  const User({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.isSuperAdmin = false,
  });

  @override
  List<Object?> get props => [id, name, email, phone, isSuperAdmin];
}
```

- [ ] **Step 2: Create auth repository interface**

```dart
// lib/features/auth/domain/repositories/auth_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/user.dart';

abstract class AuthRepository {
  Future<Either<Failure, ({User user, String token})>> login(String email, String password);
  Future<Either<Failure, ({User user, String token})>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  });
  Future<Either<Failure, User>> getMe();
  Future<Either<Failure, Unit>> logout();
  Future<bool> isAuthenticated();
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/features/auth/domain/
git commit -m "feat(customer-v2): add auth domain (User entity + repository interface)"
```

---

### Task 10: Explore/Business domain

**Files:**
- Create: `lib/features/explore/domain/entities/business.dart`
- Create: `lib/features/explore/domain/entities/service.dart`
- Create: `lib/features/explore/domain/entities/business_hours.dart`
- Create: `lib/features/explore/domain/repositories/explore_repository.dart`

- [ ] **Step 1: Create business entity**

```dart
// lib/features/explore/domain/entities/business.dart
import 'package:equatable/equatable.dart';
import 'service.dart';
import 'business_hours.dart';

class Business extends Equatable {
  final String id;
  final String slug;
  final String name;
  final String? description;
  final String? address;
  final String? phone;
  final String? businessType;
  final String? logoUrl;
  final String? coverUrl;
  final int slotDuration;
  final int cancellationHours;
  final List<Service> services;
  final List<BusinessHours> hours;

  const Business({
    required this.id,
    required this.slug,
    required this.name,
    this.description,
    this.address,
    this.phone,
    this.businessType,
    this.logoUrl,
    this.coverUrl,
    this.slotDuration = 30,
    this.cancellationHours = 1,
    this.services = const [],
    this.hours = const [],
  });

  @override
  List<Object?> get props => [id, slug];
}
```

- [ ] **Step 2: Create service entity**

```dart
// lib/features/explore/domain/entities/service.dart
import 'package:equatable/equatable.dart';

class Service extends Equatable {
  final String id;
  final String name;
  final String? description;
  final double price;
  final int durationMinutes;

  const Service({
    required this.id,
    required this.name,
    this.description,
    required this.price,
    required this.durationMinutes,
  });

  @override
  List<Object?> get props => [id];
}
```

- [ ] **Step 3: Create business_hours entity**

```dart
// lib/features/explore/domain/entities/business_hours.dart
import 'package:equatable/equatable.dart';

class BusinessHours extends Equatable {
  final int dayOfWeek; // 0=Sunday, 6=Saturday
  final String dayName;
  final bool isOpen;
  final List<TimeRange> ranges;

  const BusinessHours({
    required this.dayOfWeek,
    required this.dayName,
    required this.isOpen,
    this.ranges = const [],
  });

  @override
  List<Object?> get props => [dayOfWeek];
}

class TimeRange extends Equatable {
  final String start; // "08:00"
  final String end;   // "18:00"

  const TimeRange({required this.start, required this.end});

  @override
  List<Object?> get props => [start, end];
}
```

- [ ] **Step 4: Create explore repository interface**

```dart
// lib/features/explore/domain/repositories/explore_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/business.dart';

abstract class ExploreRepository {
  Future<Either<Failure, List<Business>>> getBusinesses({String? type});
  Future<Either<Failure, Business>> getBusinessBySlug(String slug);
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/features/explore/domain/
git commit -m "feat(customer-v2): add explore domain (Business, Service, Hours entities)"
```

---

### Task 11: Reservations domain

**Files:**
- Create: `lib/features/reservations/domain/entities/reservation.dart`
- Create: `lib/features/reservations/domain/entities/available_slot.dart`
- Create: `lib/features/reservations/domain/enums/reservation_status.dart`
- Create: `lib/features/reservations/domain/repositories/reservation_repository.dart`

- [ ] **Step 1: Create reservation_status enum**

```dart
// lib/features/reservations/domain/enums/reservation_status.dart
import 'package:flutter/material.dart';

enum ReservationStatus {
  pending,
  confirmed,
  inProgress,
  completed,
  cancelled,
  noShow;

  static ReservationStatus fromString(String value) {
    return switch (value) {
      'pending' => ReservationStatus.pending,
      'confirmed' => ReservationStatus.confirmed,
      'in_progress' => ReservationStatus.inProgress,
      'completed' => ReservationStatus.completed,
      'cancelled' => ReservationStatus.cancelled,
      'no_show' => ReservationStatus.noShow,
      _ => ReservationStatus.pending,
    };
  }

  String get label => switch (this) {
    ReservationStatus.pending => 'Pendiente',
    ReservationStatus.confirmed => 'Confirmada',
    ReservationStatus.inProgress => 'En progreso',
    ReservationStatus.completed => 'Completada',
    ReservationStatus.cancelled => 'Cancelada',
    ReservationStatus.noShow => 'No asistió',
  };

  Color get color => switch (this) {
    ReservationStatus.pending => const Color(0xFFF59E0B),
    ReservationStatus.confirmed => const Color(0xFF3B82F6),
    ReservationStatus.inProgress => const Color(0xFF8B5CF6),
    ReservationStatus.completed => const Color(0xFF10B981),
    ReservationStatus.cancelled => const Color(0xFFEF4444),
    ReservationStatus.noShow => const Color(0xFF6B7280),
  };

  bool get isUpcoming => this == pending || this == confirmed;
}
```

- [ ] **Step 2: Create reservation entity**

```dart
// lib/features/reservations/domain/entities/reservation.dart
import 'package:equatable/equatable.dart';
import '../enums/reservation_status.dart';

class Reservation extends Equatable {
  final String id;
  final String? clientResourceId;
  final String serviceId;
  final String? assignedTo;
  final DateTime scheduledAt;
  final DateTime? estimatedEnd;
  final ReservationStatus status;
  final String? notes;
  final String? clientResourceLabel;
  final String? serviceName;
  final String? servicePrice;
  final String? clientName;
  final String? tenantName;
  final String? tenantSlug;
  final int cancellationHours;

  const Reservation({
    required this.id,
    this.clientResourceId,
    required this.serviceId,
    this.assignedTo,
    required this.scheduledAt,
    this.estimatedEnd,
    required this.status,
    this.notes,
    this.clientResourceLabel,
    this.serviceName,
    this.servicePrice,
    this.clientName,
    this.tenantName,
    this.tenantSlug,
    this.cancellationHours = 1,
  });

  bool get canCancel {
    if (!status.isUpcoming) return false;
    final deadline = scheduledAt.subtract(Duration(hours: cancellationHours));
    return DateTime.now().isBefore(deadline);
  }

  @override
  List<Object?> get props => [id];
}
```

- [ ] **Step 3: Create available_slot entity**

```dart
// lib/features/reservations/domain/entities/available_slot.dart
import 'package:equatable/equatable.dart';

class AvailableSlot extends Equatable {
  final DateTime start;
  final DateTime end;
  final int available;

  const AvailableSlot({
    required this.start,
    required this.end,
    required this.available,
  });

  bool get isAvailable => available > 0;

  @override
  List<Object?> get props => [start, end];
}
```

- [ ] **Step 4: Create reservation repository interface**

```dart
// lib/features/reservations/domain/repositories/reservation_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/reservation.dart';
import '../entities/available_slot.dart';

abstract class ReservationRepository {
  Future<Either<Failure, List<Reservation>>> getAll({String? status});
  Future<Either<Failure, Reservation>> getById(String id);
  Future<Either<Failure, Reservation>> create({
    required String clientResourceId,
    required String serviceId,
    required String scheduledAt,
    String? notes,
  });
  Future<Either<Failure, List<AvailableSlot>>> getAvailableSlots(
    String date,
    String serviceId,
  );
  Future<Either<Failure, Unit>> cancel(String id, {String? reason});
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/features/reservations/domain/
git commit -m "feat(customer-v2): add reservations domain (entities + repo interface)"
```

---

### Task 12: Resources domain

**Files:**
- Create: `lib/features/resources/domain/entities/client_resource.dart`
- Create: `lib/features/resources/domain/entities/service_history_entry.dart`
- Create: `lib/features/resources/domain/repositories/resource_repository.dart`

- [ ] **Step 1: Create client_resource entity**

```dart
// lib/features/resources/domain/entities/client_resource.dart
import 'package:equatable/equatable.dart';

class ClientResource extends Equatable {
  final String id;
  final String label;
  final Map<String, dynamic>? data;

  const ClientResource({
    required this.id,
    required this.label,
    this.data,
  });

  @override
  List<Object?> get props => [id];
}
```

- [ ] **Step 2: Create service_history_entry entity**

```dart
// lib/features/resources/domain/entities/service_history_entry.dart
import 'package:equatable/equatable.dart';

class ServiceHistoryEntry extends Equatable {
  final String id;
  final String serviceName;
  final DateTime startedAt;
  final DateTime? finishedAt;
  final double priceCharged;
  final String paymentMethod;
  final String status;

  const ServiceHistoryEntry({
    required this.id,
    required this.serviceName,
    required this.startedAt,
    this.finishedAt,
    required this.priceCharged,
    required this.paymentMethod,
    required this.status,
  });

  @override
  List<Object?> get props => [id];
}
```

- [ ] **Step 3: Create resource repository interface**

```dart
// lib/features/resources/domain/repositories/resource_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/client_resource.dart';
import '../entities/service_history_entry.dart';

abstract class ResourceRepository {
  Future<Either<Failure, List<ClientResource>>> getAll();
  Future<Either<Failure, ClientResource>> create({
    required String label,
    Map<String, dynamic>? data,
  });
  Future<Either<Failure, List<ServiceHistoryEntry>>> getHistory(String resourceId);
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/features/resources/domain/
git commit -m "feat(customer-v2): add resources domain (ClientResource, history entities)"
```

---

## Phase 3: Data Layer (Repository Implementations + DTOs)

### Task 13: Auth data layer

**Files:**
- Create: `lib/features/auth/data/dtos/auth_dto.dart`
- Create: `lib/features/auth/data/repositories/auth_repository_impl.dart`

- [ ] **Step 1: Create auth DTOs**

```dart
// lib/features/auth/data/dtos/auth_dto.dart
import '../../domain/entities/user.dart';

class AuthResponseDto {
  final UserDto user;
  final String token;

  AuthResponseDto({required this.user, required this.token});

  factory AuthResponseDto.fromJson(Map<String, dynamic> json) {
    return AuthResponseDto(
      user: UserDto.fromJson(json['user'] as Map<String, dynamic>),
      token: json['token'] as String,
    );
  }
}

class UserDto {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool isSuperAdmin;

  UserDto({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.isSuperAdmin = false,
  });

  factory UserDto.fromJson(Map<String, dynamic> json) {
    return UserDto(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      isSuperAdmin: json['is_super_admin'] as bool? ?? false,
    );
  }

  User toEntity() => User(
    id: id,
    name: name,
    email: email,
    phone: phone,
    isSuperAdmin: isSuperAdmin,
  );
}
```

- [ ] **Step 2: Create auth repository implementation**

```dart
// lib/features/auth/data/repositories/auth_repository_impl.dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../dtos/auth_dto.dart';

class AuthRepositoryImpl implements AuthRepository {
  final Dio _dio = ApiClient.instance;

  @override
  Future<Either<Failure, ({User user, String token})>> login(
    String email,
    String password,
  ) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      final dto = AuthResponseDto.fromJson(
        response.data['data'] as Map<String, dynamic>,
      );
      await SecureStorage.saveToken(dto.token);
      return Right((user: dto.user.toEntity(), token: dto.token));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure('Email o contraseña incorrectos'));
      }
      return Left(_extractError(e, 'Error al iniciar sesión'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, ({User user, String token})>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  }) async {
    try {
      final response = await _dio.post('/auth/register', data: {
        'name': name,
        'email': email,
        'password': password,
        'password_confirmation': password,
        if (phone != null) 'phone': phone,
      });
      final dto = AuthResponseDto.fromJson(
        response.data['data'] as Map<String, dynamic>,
      );
      await SecureStorage.saveToken(dto.token);
      return Right((user: dto.user.toEntity(), token: dto.token));
    } on DioException catch (e) {
      return Left(_extractError(e, 'Error al registrarse'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, User>> getMe() async {
    try {
      final response = await _dio.get('/auth/me');
      final data = response.data['data'] as Map<String, dynamic>;
      final userJson = data['user'] as Map<String, dynamic>? ?? data;
      return Right(UserDto.fromJson(userJson).toEntity());
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure());
      }
      return Left(_extractError(e, 'Error al obtener perfil'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> logout() async {
    try {
      await _dio.post('/auth/logout');
    } catch (_) {
      // Logout even if API call fails
    }
    await SecureStorage.clear();
    ApiClient.reset();
    return const Right(unit);
  }

  @override
  Future<bool> isAuthenticated() async {
    final token = await SecureStorage.getToken();
    return token != null;
  }

  ServerFailure _extractError(DioException e, String fallback) {
    final data = e.response?.data;
    if (data is Map) {
      // Check validation errors first
      if (data['errors'] is Map) {
        final errors = data['errors'] as Map;
        if (errors.isNotEmpty) {
          final first = errors.values.first;
          if (first is List && first.isNotEmpty) {
            return ServerFailure(first.first.toString());
          }
        }
      }
      final msg = data['error']?['message'] ?? data['message'];
      if (msg != null) return ServerFailure(msg.toString());
    }
    return ServerFailure(fallback);
  }
}
```

- [ ] **Step 3: Register in DI**

Add to `lib/core/di/injection.dart`:

```dart
// lib/core/di/injection.dart
import 'package:get_it/get_it.dart';
import 'package:dio/dio.dart';
import '../network/api_client.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';

final getIt = GetIt.instance;

void configureDependencies() {
  // Network
  getIt.registerLazySingleton<Dio>(() => ApiClient.instance);

  // Auth
  getIt.registerLazySingleton<AuthRepository>(() => AuthRepositoryImpl());
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/features/auth/data/ lib/core/di/
git commit -m "feat(customer-v2): add auth data layer (DTOs, repository impl)"
```

---

### Task 14: Explore data layer

**Files:**
- Create: `lib/features/explore/data/dtos/business_dto.dart`
- Create: `lib/features/explore/data/repositories/explore_repository_impl.dart`

- [ ] **Step 1: Create business DTOs**

```dart
// lib/features/explore/data/dtos/business_dto.dart
import '../../domain/entities/business.dart';
import '../../domain/entities/service.dart';
import '../../domain/entities/business_hours.dart';

class BusinessDto {
  final Map<String, dynamic> json;

  BusinessDto(this.json);

  Business toEntity() {
    final servicesJson = json['services'] as List<dynamic>? ?? [];
    final hoursJson = json['availability'] as List<dynamic>? ?? [];

    return Business(
      id: json['id'] as String,
      slug: json['slug'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      address: json['address'] as String?,
      phone: json['phone'] as String?,
      businessType: json['business_type'] as String?,
      logoUrl: json['logo_url'] as String?,
      coverUrl: json['cover_url'] as String?,
      slotDuration: json['slot_duration'] as int? ?? 30,
      cancellationHours: json['cancellation_hours'] as int? ?? 1,
      services: servicesJson
          .map((s) => _serviceFromJson(s as Map<String, dynamic>))
          .toList(),
      hours: hoursJson
          .map((h) => _hoursFromJson(h as Map<String, dynamic>))
          .toList(),
    );
  }

  static Service _serviceFromJson(Map<String, dynamic> json) {
    return Service(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      price: (json['price'] as num).toDouble(),
      durationMinutes: json['duration_minutes'] as int? ?? 30,
    );
  }

  static BusinessHours _hoursFromJson(Map<String, dynamic> json) {
    final rangesJson = json['ranges'] as List<dynamic>? ?? [];
    return BusinessHours(
      dayOfWeek: json['day_of_week'] as int,
      dayName: json['day_name'] as String? ?? '',
      isOpen: json['is_open'] as bool? ?? false,
      ranges: rangesJson.map((r) {
        final m = r as Map<String, dynamic>;
        return TimeRange(
          start: m['start'] as String,
          end: m['end'] as String,
        );
      }).toList(),
    );
  }
}
```

- [ ] **Step 2: Create explore repository implementation**

```dart
// lib/features/explore/data/repositories/explore_repository_impl.dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/business.dart';
import '../../domain/repositories/explore_repository.dart';
import '../dtos/business_dto.dart';

class ExploreRepositoryImpl implements ExploreRepository {
  final Dio _dio = ApiClient.instance;

  @override
  Future<Either<Failure, List<Business>>> getBusinesses({String? type}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (type != null) queryParams['type'] = type;

      final response = await _dio.get(
        '/public/tenants',
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );

      final data = response.data['data'] as List<dynamic>;
      final businesses = data
          .map((e) => BusinessDto(e as Map<String, dynamic>).toEntity())
          .toList();
      return Right(businesses);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al cargar negocios',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Business>> getBusinessBySlug(String slug) async {
    try {
      final response = await _dio.get('/public/tenants/$slug');
      final business = BusinessDto(
        response.data['data'] as Map<String, dynamic>,
      ).toEntity();
      return Right(business);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        return const Left(NotFoundFailure('Negocio no encontrado'));
      }
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al cargar negocio',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
```

- [ ] **Step 3: Register in DI — update injection.dart**

Add these imports and registrations to `lib/core/di/injection.dart`:

```dart
import '../../features/explore/domain/repositories/explore_repository.dart';
import '../../features/explore/data/repositories/explore_repository_impl.dart';
```

Inside `configureDependencies()` add:

```dart
  // Explore
  getIt.registerLazySingleton<ExploreRepository>(() => ExploreRepositoryImpl());
```

- [ ] **Step 4: Commit**

```bash
git add lib/features/explore/data/ lib/core/di/
git commit -m "feat(customer-v2): add explore data layer (business DTOs, repository impl)"
```

---

### Task 15: Reservations data layer

**Files:**
- Create: `lib/features/reservations/data/dtos/reservation_dto.dart`
- Create: `lib/features/reservations/data/repositories/reservation_repository_impl.dart`

- [ ] **Step 1: Create reservation DTO**

```dart
// lib/features/reservations/data/dtos/reservation_dto.dart
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';

class ReservationDto {
  final Map<String, dynamic> json;

  ReservationDto(this.json);

  Reservation toEntity() {
    final service = json['service'] as Map<String, dynamic>?;
    final client = json['client'] as Map<String, dynamic>?;
    final tenant = json['tenant'] as Map<String, dynamic>?;
    final clientResource = json['client_resource'] as Map<String, dynamic>?;

    return Reservation(
      id: json['id'] as String,
      clientResourceId: json['client_resource_id'] as String?,
      serviceId: json['service_id'] as String,
      assignedTo: json['assigned_to'] as String?,
      scheduledAt: DateTime.parse(json['scheduled_at'] as String),
      estimatedEnd: json['estimated_end'] != null
          ? DateTime.parse(json['estimated_end'] as String)
          : null,
      status: ReservationStatus.fromString(json['status'] as String),
      notes: json['notes'] as String?,
      clientResourceLabel: clientResource?['label'] as String? ??
          clientResource?['plate'] as String?,
      serviceName: service?['name'] as String?,
      servicePrice: service?['price']?.toString(),
      clientName: client?['name'] as String?,
      tenantName: tenant?['name'] as String?,
      tenantSlug: tenant?['slug'] as String?,
      cancellationHours: tenant?['cancellation_hours'] as int? ?? 1,
    );
  }
}
```

- [ ] **Step 2: Create reservation repository implementation**

```dart
// lib/features/reservations/data/repositories/reservation_repository_impl.dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/entities/available_slot.dart';
import '../../domain/repositories/reservation_repository.dart';
import '../dtos/reservation_dto.dart';

class ReservationRepositoryImpl implements ReservationRepository {
  final Dio _dio = ApiClient.instance;

  @override
  Future<Either<Failure, List<Reservation>>> getAll({String? status}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null) queryParams['status'] = status;

      final response = await _dio.get(
        '/client/reservations',
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );

      final data = response.data['data'] as List<dynamic>;
      final reservations = data
          .map((e) => ReservationDto(e as Map<String, dynamic>).toEntity())
          .toList();
      return Right(reservations);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener reservas',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Reservation>> getById(String id) async {
    try {
      final response = await _dio.get('/client/reservations/$id');
      return Right(
        ReservationDto(response.data['data'] as Map<String, dynamic>).toEntity(),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        return const Left(NotFoundFailure('Reserva no encontrada'));
      }
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener reserva',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Reservation>> create({
    required String clientResourceId,
    required String serviceId,
    required String scheduledAt,
    String? notes,
  }) async {
    try {
      final response = await _dio.post('/reservations', data: {
        'client_resource_id': clientResourceId,
        'service_id': serviceId,
        'scheduled_at': scheduledAt,
        if (notes != null) 'notes': notes,
      });
      return Right(
        ReservationDto(response.data['data'] as Map<String, dynamic>).toEntity(),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al crear reserva',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, List<AvailableSlot>>> getAvailableSlots(
    String date,
    String serviceId,
  ) async {
    try {
      final response = await _dio.get(
        '/reservations/available-slots',
        queryParameters: {'date': date, 'service_id': serviceId},
      );

      final data = response.data['data'] as List<dynamic>;
      final slots = data.map((e) {
        final map = e as Map<String, dynamic>;
        return AvailableSlot(
          start: DateTime.parse(map['start'] as String),
          end: DateTime.parse(map['end'] as String),
          available: map['available'] as int,
        );
      }).toList();
      return Right(slots);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener horarios',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> cancel(String id, {String? reason}) async {
    try {
      await _dio.patch('/client/reservations/$id/cancel', data: {
        if (reason != null) 'reason': reason,
      });
      return const Right(unit);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al cancelar reserva',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
```

- [ ] **Step 3: Register in DI**

Add to `lib/core/di/injection.dart`:

```dart
import '../../features/reservations/domain/repositories/reservation_repository.dart';
import '../../features/reservations/data/repositories/reservation_repository_impl.dart';
```

Inside `configureDependencies()`:

```dart
  // Reservations
  getIt.registerLazySingleton<ReservationRepository>(() => ReservationRepositoryImpl());
```

- [ ] **Step 4: Commit**

```bash
git add lib/features/reservations/data/ lib/core/di/
git commit -m "feat(customer-v2): add reservations data layer"
```

---

### Task 16: Resources data layer

**Files:**
- Create: `lib/features/resources/data/repositories/resource_repository_impl.dart`

- [ ] **Step 1: Create resource repository implementation**

```dart
// lib/features/resources/data/repositories/resource_repository_impl.dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/client_resource.dart';
import '../../domain/entities/service_history_entry.dart';
import '../../domain/repositories/resource_repository.dart';

class ResourceRepositoryImpl implements ResourceRepository {
  final Dio _dio = ApiClient.instance;

  @override
  Future<Either<Failure, List<ClientResource>>> getAll() async {
    try {
      final response = await _dio.get('/client-resources');
      final data = response.data['data'] as List<dynamic>;
      final resources = data.map((e) {
        final json = e as Map<String, dynamic>;
        return ClientResource(
          id: json['id'] as String,
          label: json['label'] as String? ?? json['id'] as String,
          data: json['data'] as Map<String, dynamic>?,
        );
      }).toList();
      return Right(resources);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener registros',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, ClientResource>> create({
    required String label,
    Map<String, dynamic>? data,
  }) async {
    try {
      final response = await _dio.post('/client-resources', data: {
        'label': label,
        if (data != null) 'data': data,
      });
      final json = response.data['data'] as Map<String, dynamic>;
      return Right(ClientResource(
        id: json['id'] as String,
        label: json['label'] as String? ?? label,
        data: json['data'] as Map<String, dynamic>?,
      ));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al crear registro',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, List<ServiceHistoryEntry>>> getHistory(
    String resourceId,
  ) async {
    try {
      final response = await _dio.get('/client-resources/$resourceId/history');
      final data = response.data['data'] as List<dynamic>;
      final entries = data.map((e) {
        final json = e as Map<String, dynamic>;
        return ServiceHistoryEntry(
          id: json['id'] as String,
          serviceName: json['service_name'] as String,
          startedAt: DateTime.parse(json['started_at'] as String),
          finishedAt: json['finished_at'] != null
              ? DateTime.parse(json['finished_at'] as String)
              : null,
          priceCharged: (json['price_charged'] as num).toDouble(),
          paymentMethod: json['payment_method'] as String,
          status: json['status'] as String,
        );
      }).toList();
      return Right(entries);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      if (e.response?.statusCode == 404) {
        return const Left(NotFoundFailure('Registro no encontrado'));
      }
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener historial',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
```

- [ ] **Step 2: Register in DI**

Add to `lib/core/di/injection.dart`:

```dart
import '../../features/resources/domain/repositories/resource_repository.dart';
import '../../features/resources/data/repositories/resource_repository_impl.dart';
```

Inside `configureDependencies()`:

```dart
  // Resources
  getIt.registerLazySingleton<ResourceRepository>(() => ResourceRepositoryImpl());
```

- [ ] **Step 3: Commit**

```bash
git add lib/features/resources/data/ lib/core/di/
git commit -m "feat(customer-v2): add resources data layer"
```

---

## Phase 4: Shared Widgets

### Task 17: Core shared widgets

**Files:**
- Create: `lib/shared/widgets/app_button.dart`
- Create: `lib/shared/widgets/app_text_field.dart`
- Create: `lib/shared/widgets/status_badge.dart`
- Create: `lib/shared/widgets/section_header.dart`
- Create: `lib/shared/widgets/empty_state.dart`
- Create: `lib/shared/widgets/shimmer_loader.dart`
- Create: `lib/shared/widgets/avatar_circle.dart`

- [ ] **Step 1: Create app_button.dart**

```dart
// lib/shared/widgets/app_button.dart
import 'package:flutter/material.dart';

enum AppButtonVariant { primary, secondary, outline, ghost }

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final bool isLoading;
  final bool fullWidth;
  final IconData? icon;
  final Color? color;

  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.isLoading = false,
    this.fullWidth = true,
    this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primaryColor = color ?? theme.colorScheme.primary;

    final style = switch (variant) {
      AppButtonVariant.primary => ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        ),
      AppButtonVariant.secondary => ElevatedButton.styleFrom(
          backgroundColor: primaryColor.withValues(alpha: 0.1),
          foregroundColor: primaryColor,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        ),
      AppButtonVariant.outline => OutlinedButton.styleFrom(
          foregroundColor: primaryColor,
          side: BorderSide(color: primaryColor),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        ),
      AppButtonVariant.ghost => TextButton.styleFrom(
          foregroundColor: primaryColor,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        ),
    };

    final child = isLoading
        ? SizedBox(
            height: 20,
            width: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: variant == AppButtonVariant.primary
                  ? Colors.white
                  : primaryColor,
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18),
                const SizedBox(width: 8),
              ],
              Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
          );

    final button = variant == AppButtonVariant.outline
        ? OutlinedButton(
            onPressed: isLoading ? null : onPressed,
            style: style,
            child: child,
          )
        : variant == AppButtonVariant.ghost
            ? TextButton(
                onPressed: isLoading ? null : onPressed,
                style: style,
                child: child,
              )
            : ElevatedButton(
                onPressed: isLoading ? null : onPressed,
                style: style,
                child: child,
              );

    return fullWidth ? SizedBox(width: double.infinity, child: button) : button;
  }
}
```

- [ ] **Step 2: Create app_text_field.dart**

```dart
// lib/shared/widgets/app_text_field.dart
import 'package:flutter/material.dart';
import '../../app/theme/app_colors.dart';

class AppTextField extends StatelessWidget {
  final String? label;
  final String? hint;
  final TextEditingController? controller;
  final String? Function(String?)? validator;
  final bool obscureText;
  final TextInputType? keyboardType;
  final Widget? suffixIcon;
  final Widget? prefixIcon;
  final int maxLines;
  final ValueChanged<String>? onChanged;

  const AppTextField({
    super.key,
    this.label,
    this.hint,
    this.controller,
    this.validator,
    this.obscureText = false,
    this.keyboardType,
    this.suffixIcon,
    this.prefixIcon,
    this.maxLines = 1,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[
          Text(
            label!,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
        ],
        TextFormField(
          controller: controller,
          validator: validator,
          obscureText: obscureText,
          keyboardType: keyboardType,
          maxLines: maxLines,
          onChanged: onChanged,
          decoration: InputDecoration(
            hintText: hint,
            suffixIcon: suffixIcon,
            prefixIcon: prefixIcon,
          ),
        ),
      ],
    );
  }
}
```

- [ ] **Step 3: Create status_badge.dart**

```dart
// lib/shared/widgets/status_badge.dart
import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const StatusBadge({super.key, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Create section_header.dart**

```dart
// lib/shared/widgets/section_header.dart
import 'package:flutter/material.dart';
import '../../app/theme/app_colors.dart';

class SectionHeader extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const SectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        if (actionLabel != null)
          GestureDetector(
            onTap: onAction,
            child: Text(
              actionLabel!,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          ),
      ],
    );
  }
}
```

- [ ] **Step 5: Create empty_state.dart**

```dart
// lib/shared/widgets/empty_state.dart
import 'package:flutter/material.dart';
import '../../app/theme/app_colors.dart';
import 'app_button.dart';

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.accentLight,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 40, color: AppColors.accent),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitle!,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 20),
              AppButton(
                label: actionLabel!,
                onPressed: onAction,
                fullWidth: false,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 6: Create shimmer_loader.dart**

```dart
// lib/shared/widgets/shimmer_loader.dart
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class ShimmerLoader extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const ShimmerLoader({
    super.key,
    this.width = double.infinity,
    required this.height,
    this.borderRadius = 12,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey.shade200,
      highlightColor: Colors.grey.shade50,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }

  /// Card-shaped shimmer placeholder
  static Widget card({double height = 120}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ShimmerLoader(height: height, borderRadius: 16),
    );
  }

  /// List of shimmer cards
  static Widget list({int count = 3, double itemHeight = 120}) {
    return Column(
      children: List.generate(count, (_) => card(height: itemHeight)),
    );
  }
}
```

- [ ] **Step 7: Create avatar_circle.dart**

```dart
// lib/shared/widgets/avatar_circle.dart
import 'package:flutter/material.dart';

class AvatarCircle extends StatelessWidget {
  final String name;
  final double size;
  final String? imageUrl;

  const AvatarCircle({
    super.key,
    required this.name,
    this.size = 40,
    this.imageUrl,
  });

  String get _initials {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: color.withValues(alpha: 0.1),
      backgroundImage: imageUrl != null ? NetworkImage(imageUrl!) : null,
      child: imageUrl == null
          ? Text(
              _initials,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w600,
                fontSize: size * 0.35,
              ),
            )
          : null,
    );
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/shared/widgets/
git commit -m "feat(customer-v2): add shared widgets (button, text field, badges, shimmer, etc.)"
```

---

## Phase 5: Presentation Layer — Cubits

### Task 18: Auth cubits (Login + Register)

**Files:**
- Create: `lib/features/auth/presentation/cubit/auth_state.dart`
- Create: `lib/features/auth/presentation/cubit/auth_cubit.dart`

- [ ] **Step 1: Create auth_state.dart**

```dart
// lib/features/auth/presentation/cubit/auth_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/user.dart';

sealed class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  final User user;
  const AuthAuthenticated(this.user);

  @override
  List<Object?> get props => [user];
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

class AuthError extends AuthState {
  final String message;
  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}
```

- [ ] **Step 2: Create auth_cubit.dart**

```dart
// lib/features/auth/presentation/cubit/auth_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/auth_repository.dart';
import 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  final AuthRepository _repository;

  AuthCubit(this._repository) : super(const AuthInitial());

  Future<void> login(String email, String password) async {
    emit(const AuthLoading());
    final result = await _repository.login(email, password);
    result.fold(
      (failure) => emit(AuthError(failure.message)),
      (data) => emit(AuthAuthenticated(data.user)),
    );
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  }) async {
    emit(const AuthLoading());
    final result = await _repository.register(
      name: name,
      email: email,
      password: password,
      phone: phone,
    );
    result.fold(
      (failure) => emit(AuthError(failure.message)),
      (data) => emit(AuthAuthenticated(data.user)),
    );
  }

  Future<void> getMe() async {
    emit(const AuthLoading());
    final result = await _repository.getMe();
    result.fold(
      (failure) => emit(const AuthUnauthenticated()),
      (user) => emit(AuthAuthenticated(user)),
    );
  }

  Future<void> logout() async {
    await _repository.logout();
    emit(const AuthUnauthenticated());
  }

  Future<void> checkAuth() async {
    final isAuth = await _repository.isAuthenticated();
    if (isAuth) {
      await getMe();
    } else {
      emit(const AuthUnauthenticated());
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/features/auth/presentation/cubit/
git commit -m "feat(customer-v2): add auth cubit (login, register, logout)"
```

---

### Task 19: Explore cubit

**Files:**
- Create: `lib/features/explore/presentation/cubit/explore_state.dart`
- Create: `lib/features/explore/presentation/cubit/explore_cubit.dart`

- [ ] **Step 1: Create explore_state.dart**

```dart
// lib/features/explore/presentation/cubit/explore_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/business.dart';

sealed class ExploreState extends Equatable {
  const ExploreState();
  @override
  List<Object?> get props => [];
}

class ExploreInitial extends ExploreState {
  const ExploreInitial();
}

class ExploreLoading extends ExploreState {
  const ExploreLoading();
}

class ExploreLoaded extends ExploreState {
  final List<Business> businesses;
  final String? activeFilter;
  final String searchQuery;

  const ExploreLoaded({
    required this.businesses,
    this.activeFilter,
    this.searchQuery = '',
  });

  List<Business> get filtered {
    var result = businesses;
    if (searchQuery.isNotEmpty) {
      final q = searchQuery.toLowerCase();
      result = result.where((b) => b.name.toLowerCase().contains(q)).toList();
    }
    return result;
  }

  @override
  List<Object?> get props => [businesses, activeFilter, searchQuery];
}

class ExploreError extends ExploreState {
  final String message;
  const ExploreError(this.message);
  @override
  List<Object?> get props => [message];
}
```

- [ ] **Step 2: Create explore_cubit.dart**

```dart
// lib/features/explore/presentation/cubit/explore_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/explore_repository.dart';
import 'explore_state.dart';

class ExploreCubit extends Cubit<ExploreState> {
  final ExploreRepository _repository;

  ExploreCubit(this._repository) : super(const ExploreInitial());

  Future<void> loadBusinesses({String? type}) async {
    emit(const ExploreLoading());
    final result = await _repository.getBusinesses(type: type);
    result.fold(
      (failure) => emit(ExploreError(failure.message)),
      (businesses) => emit(ExploreLoaded(
        businesses: businesses,
        activeFilter: type,
      )),
    );
  }

  void search(String query) {
    final current = state;
    if (current is ExploreLoaded) {
      emit(ExploreLoaded(
        businesses: current.businesses,
        activeFilter: current.activeFilter,
        searchQuery: query,
      ));
    }
  }

  void filterByType(String? type) {
    loadBusinesses(type: type);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/features/explore/presentation/cubit/
git commit -m "feat(customer-v2): add explore cubit (load businesses, search, filter)"
```

---

### Task 20: Business detail cubit

**Files:**
- Create: `lib/features/business/presentation/cubit/business_detail_state.dart`
- Create: `lib/features/business/presentation/cubit/business_detail_cubit.dart`

- [ ] **Step 1: Create business_detail_state.dart**

```dart
// lib/features/business/presentation/cubit/business_detail_state.dart
import 'package:equatable/equatable.dart';
import '../../../explore/domain/entities/business.dart';

sealed class BusinessDetailState extends Equatable {
  const BusinessDetailState();
  @override
  List<Object?> get props => [];
}

class BusinessDetailInitial extends BusinessDetailState {
  const BusinessDetailInitial();
}

class BusinessDetailLoading extends BusinessDetailState {
  const BusinessDetailLoading();
}

class BusinessDetailLoaded extends BusinessDetailState {
  final Business business;
  const BusinessDetailLoaded(this.business);
  @override
  List<Object?> get props => [business];
}

class BusinessDetailError extends BusinessDetailState {
  final String message;
  const BusinessDetailError(this.message);
  @override
  List<Object?> get props => [message];
}
```

- [ ] **Step 2: Create business_detail_cubit.dart**

```dart
// lib/features/business/presentation/cubit/business_detail_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../explore/domain/repositories/explore_repository.dart';
import 'business_detail_state.dart';

class BusinessDetailCubit extends Cubit<BusinessDetailState> {
  final ExploreRepository _repository;

  BusinessDetailCubit(this._repository) : super(const BusinessDetailInitial());

  Future<void> loadBusiness(String slug) async {
    emit(const BusinessDetailLoading());
    final result = await _repository.getBusinessBySlug(slug);
    result.fold(
      (failure) => emit(BusinessDetailError(failure.message)),
      (business) => emit(BusinessDetailLoaded(business)),
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/features/business/presentation/cubit/
git commit -m "feat(customer-v2): add business detail cubit"
```

---

### Task 21: Reservations cubit

**Files:**
- Create: `lib/features/reservations/presentation/cubit/reservations_state.dart`
- Create: `lib/features/reservations/presentation/cubit/reservations_cubit.dart`
- Create: `lib/features/reservations/presentation/cubit/create_reservation_state.dart`
- Create: `lib/features/reservations/presentation/cubit/create_reservation_cubit.dart`

- [ ] **Step 1: Create reservations_state.dart**

```dart
// lib/features/reservations/presentation/cubit/reservations_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/reservation.dart';

sealed class ReservationsState extends Equatable {
  const ReservationsState();
  @override
  List<Object?> get props => [];
}

class ReservationsInitial extends ReservationsState {
  const ReservationsInitial();
}

class ReservationsLoading extends ReservationsState {
  const ReservationsLoading();
}

class ReservationsLoaded extends ReservationsState {
  final List<Reservation> reservations;
  const ReservationsLoaded(this.reservations);
  @override
  List<Object?> get props => [reservations];
}

class ReservationsError extends ReservationsState {
  final String message;
  const ReservationsError(this.message);
  @override
  List<Object?> get props => [message];
}
```

- [ ] **Step 2: Create reservations_cubit.dart**

```dart
// lib/features/reservations/presentation/cubit/reservations_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/reservation_repository.dart';
import 'reservations_state.dart';

class ReservationsCubit extends Cubit<ReservationsState> {
  final ReservationRepository _repository;

  ReservationsCubit(this._repository) : super(const ReservationsInitial());

  Future<void> loadReservations({String? status}) async {
    emit(const ReservationsLoading());
    final result = await _repository.getAll(status: status);
    result.fold(
      (failure) => emit(ReservationsError(failure.message)),
      (reservations) => emit(ReservationsLoaded(reservations)),
    );
  }

  Future<bool> cancelReservation(String id, {String? reason}) async {
    final result = await _repository.cancel(id, reason: reason);
    return result.isRight();
  }
}
```

- [ ] **Step 3: Create create_reservation_state.dart**

```dart
// lib/features/reservations/presentation/cubit/create_reservation_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/available_slot.dart';
import '../../domain/entities/reservation.dart';
import '../../../resources/domain/entities/client_resource.dart';

sealed class CreateReservationState extends Equatable {
  const CreateReservationState();
  @override
  List<Object?> get props => [];
}

class CreateReservationInitial extends CreateReservationState {
  const CreateReservationInitial();
}

class CreateReservationLoadingSlots extends CreateReservationState {
  const CreateReservationLoadingSlots();
}

class CreateReservationSlotsLoaded extends CreateReservationState {
  final List<AvailableSlot> slots;
  const CreateReservationSlotsLoaded(this.slots);
  @override
  List<Object?> get props => [slots];
}

class CreateReservationSubmitting extends CreateReservationState {
  const CreateReservationSubmitting();
}

class CreateReservationSuccess extends CreateReservationState {
  final Reservation reservation;
  const CreateReservationSuccess(this.reservation);
  @override
  List<Object?> get props => [reservation];
}

class CreateReservationError extends CreateReservationState {
  final String message;
  const CreateReservationError(this.message);
  @override
  List<Object?> get props => [message];
}
```

- [ ] **Step 4: Create create_reservation_cubit.dart**

```dart
// lib/features/reservations/presentation/cubit/create_reservation_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/reservation_repository.dart';
import 'create_reservation_state.dart';

class CreateReservationCubit extends Cubit<CreateReservationState> {
  final ReservationRepository _repository;

  CreateReservationCubit(this._repository)
      : super(const CreateReservationInitial());

  Future<void> loadSlots(String date, String serviceId) async {
    emit(const CreateReservationLoadingSlots());
    final result = await _repository.getAvailableSlots(date, serviceId);
    result.fold(
      (failure) => emit(CreateReservationError(failure.message)),
      (slots) => emit(CreateReservationSlotsLoaded(slots)),
    );
  }

  Future<void> createReservation({
    required String clientResourceId,
    required String serviceId,
    required String scheduledAt,
    String? notes,
  }) async {
    emit(const CreateReservationSubmitting());
    final result = await _repository.create(
      clientResourceId: clientResourceId,
      serviceId: serviceId,
      scheduledAt: scheduledAt,
      notes: notes,
    );
    result.fold(
      (failure) => emit(CreateReservationError(failure.message)),
      (reservation) => emit(CreateReservationSuccess(reservation)),
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/features/reservations/presentation/cubit/
git commit -m "feat(customer-v2): add reservations cubits (list + create)"
```

---

### Task 22: Resources cubit

**Files:**
- Create: `lib/features/resources/presentation/cubit/resources_state.dart`
- Create: `lib/features/resources/presentation/cubit/resources_cubit.dart`

- [ ] **Step 1: Create resources_state.dart**

```dart
// lib/features/resources/presentation/cubit/resources_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/client_resource.dart';

sealed class ResourcesState extends Equatable {
  const ResourcesState();
  @override
  List<Object?> get props => [];
}

class ResourcesInitial extends ResourcesState {
  const ResourcesInitial();
}

class ResourcesLoading extends ResourcesState {
  const ResourcesLoading();
}

class ResourcesLoaded extends ResourcesState {
  final List<ClientResource> resources;
  const ResourcesLoaded(this.resources);
  @override
  List<Object?> get props => [resources];
}

class ResourcesError extends ResourcesState {
  final String message;
  const ResourcesError(this.message);
  @override
  List<Object?> get props => [message];
}
```

- [ ] **Step 2: Create resources_cubit.dart**

```dart
// lib/features/resources/presentation/cubit/resources_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/resource_repository.dart';
import 'resources_state.dart';

class ResourcesCubit extends Cubit<ResourcesState> {
  final ResourceRepository _repository;

  ResourcesCubit(this._repository) : super(const ResourcesInitial());

  Future<void> loadResources() async {
    emit(const ResourcesLoading());
    final result = await _repository.getAll();
    result.fold(
      (failure) => emit(ResourcesError(failure.message)),
      (resources) => emit(ResourcesLoaded(resources)),
    );
  }

  Future<bool> createResource({
    required String label,
    Map<String, dynamic>? data,
  }) async {
    final result = await _repository.create(label: label, data: data);
    if (result.isRight()) {
      await loadResources(); // Reload list
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/features/resources/presentation/cubit/
git commit -m "feat(customer-v2): add resources cubit"
```

---

## Phase 6: Screens — Stub all screens, then flesh out

### Task 23: Create all stub screens

Create minimal placeholder screens so the router compiles. Each screen will be fleshed out in subsequent tasks.

**Files:** Create all screen files listed in router.dart

- [ ] **Step 1: Create all stub screens**

Create each file with this pattern (adjust class name and text per screen):

```dart
// lib/features/onboarding/presentation/screens/onboarding_screen.dart
import 'package:flutter/material.dart';

class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: Text('Onboarding')));
  }
}
```

Create these files:
- `lib/features/onboarding/presentation/screens/onboarding_screen.dart`
- `lib/features/auth/presentation/screens/login_screen.dart`
- `lib/features/auth/presentation/screens/register_screen.dart`
- `lib/features/home/presentation/screens/main_shell.dart` (see step 2)
- `lib/features/explore/presentation/screens/explore_screen.dart`
- `lib/features/business/presentation/screens/business_detail_screen.dart` (needs `slug` param)
- `lib/features/reservations/presentation/screens/reservations_screen.dart`
- `lib/features/reservations/presentation/screens/create_reservation_screen.dart` (needs `tenantSlug` + `serviceId?` params)
- `lib/features/reservations/presentation/screens/reservation_detail_screen.dart` (needs `reservationId` param)
- `lib/features/profile/presentation/screens/profile_screen.dart`
- `lib/features/resources/presentation/screens/resources_screen.dart`
- `lib/features/resources/presentation/screens/add_resource_screen.dart`
- `lib/features/resources/presentation/screens/resource_history_screen.dart` (needs `resourceId` + `label` params)
- `lib/features/favorites/presentation/screens/favorites_screen.dart`
- `lib/features/notifications/presentation/screens/notifications_screen.dart`

- [ ] **Step 2: Create MainShell with bottom navigation**

```dart
// lib/features/home/presentation/screens/main_shell.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';

class MainShell extends StatelessWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/reservations')) return 1;
    if (location.startsWith('/profile')) return 2;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final index = _currentIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _NavItem(
                  icon: Icons.explore_outlined,
                  activeIcon: Icons.explore,
                  label: 'Inicio',
                  isActive: index == 0,
                  onTap: () => context.go('/home'),
                ),
                _NavItem(
                  icon: Icons.calendar_today_outlined,
                  activeIcon: Icons.calendar_today,
                  label: 'Reservas',
                  isActive: index == 1,
                  onTap: () => context.go('/reservations'),
                ),
                _NavItem(
                  icon: Icons.person_outline,
                  activeIcon: Icons.person,
                  label: 'Perfil',
                  isActive: index == 2,
                  onTap: () => context.go('/profile'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = isActive
        ? Theme.of(context).colorScheme.primary
        : AppColors.textTertiary;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(isActive ? activeIcon : icon, color: color, size: 24),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 3: Verify app compiles**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/customer_v2
flutter analyze
```
Expected: No errors (warnings OK)

- [ ] **Step 4: Commit**

```bash
git add lib/features/
git commit -m "feat(customer-v2): add all stub screens + MainShell with bottom nav"
```

---

## Phase 7: Screens — Full Implementation

> **Note to implementer:** From here, each task creates one complete screen. These tasks are independent and can be parallelized. Each screen should use the cubits created in Phase 5 and shared widgets from Phase 4. Follow the visual design principles from the spec: soft shadows, generous spacing, rounded corners, shimmer loading states.

### Task 24: Onboarding screen

**Files:**
- Modify: `lib/features/onboarding/presentation/screens/onboarding_screen.dart`

Implement 3 slides with `PageView`, `smooth_page_indicator` dots, "Comenzar" button on last slide. Store `onboarding_seen` flag in SharedPreferences. Redirect to `/login`. Use `flutter_animate` for fade transitions.

---

### Task 25: Login screen

**Files:**
- Modify: `lib/features/auth/presentation/screens/login_screen.dart`

Clean design: logo top, email + password fields using `AppTextField`, login button using `AppButton` with loading state. Error shown as red banner. Link to register. Use `BlocProvider` + `BlocConsumer` with `AuthCubit`. On success navigate to `/home`.

---

### Task 26: Register screen

**Files:**
- Modify: `lib/features/auth/presentation/screens/register_screen.dart`

Similar to login: name, email, password, optional phone fields. Validation inline. Use `AuthCubit.register()`. Link back to login.

---

### Task 27: Explore screen (Home tab)

**Files:**
- Modify: `lib/features/explore/presentation/screens/explore_screen.dart`
- Create: `lib/features/explore/presentation/widgets/business_card.dart`
- Create: `lib/features/explore/presentation/widgets/category_chips.dart`
- Create: `lib/features/explore/presentation/widgets/next_reservation_card.dart`

Header with greeting + avatar. Search bar. Next reservation card (fetch from ReservationsCubit). Category filter chips. Business cards grid/list with cover image, name, type badge, favorite heart. Pull-to-refresh. Shimmer loading.

---

### Task 28: Business detail screen

**Files:**
- Modify: `lib/features/business/presentation/screens/business_detail_screen.dart`
- Create: `lib/features/business/presentation/widgets/hero_header.dart`
- Create: `lib/features/business/presentation/widgets/service_card.dart`
- Create: `lib/features/business/presentation/widgets/hours_section.dart`

Apply dynamic `TenantTheme` based on `business.businessType`. Hero header with cover image + gradient. Tab bar: Servicios / Info / Horarios. Service cards with price + "Reservar" button. FAB "Reservar". Navigate to create reservation with tenantSlug + serviceId.

---

### Task 29: Create reservation screen (wizard)

**Files:**
- Modify: `lib/features/reservations/presentation/screens/create_reservation_screen.dart`
- Create: `lib/features/reservations/presentation/widgets/step_indicator.dart`
- Create: `lib/features/reservations/presentation/widgets/slot_chip.dart`

3-step wizard: Step 1 select resource, Step 2 date + slot picker, Step 3 notes + confirm. Animated `StepIndicator` at top. Date picker + horizontal slot chips. Save tenant slug to SecureStorage before API calls. Success → navigate to reservation detail.

---

### Task 30: Reservations screen (Tab 2)

**Files:**
- Modify: `lib/features/reservations/presentation/screens/reservations_screen.dart`
- Create: `lib/features/reservations/presentation/widgets/reservation_card.dart`

Tab bar: Próximas / Completadas / Canceladas. `ReservationCard` with business name, service, date/time, `StatusBadge`. Pull-to-refresh. Empty state per tab. Tap → reservation detail.

---

### Task 31: Reservation detail screen

**Files:**
- Modify: `lib/features/reservations/presentation/screens/reservation_detail_screen.dart`

Large card with all reservation info. Status badge prominent. Cancel button (if `canCancel`). Business info section. Notes section. Shimmer loading.

---

### Task 32: Profile screen (Tab 3)

**Files:**
- Modify: `lib/features/profile/presentation/screens/profile_screen.dart`

`AvatarCircle` + name + email at top. Menu items: Mis Registros, Notificaciones, Favoritos, Ayuda, Cerrar sesión. Each as a row with icon + chevron. Logout uses `AuthCubit.logout()` → navigate to `/login`.

---

### Task 33: Resources screens

**Files:**
- Modify: `lib/features/resources/presentation/screens/resources_screen.dart`
- Modify: `lib/features/resources/presentation/screens/add_resource_screen.dart`
- Modify: `lib/features/resources/presentation/screens/resource_history_screen.dart`

Resources list with cards. Add resource form (label + optional data). History list with service entries showing date, price, status.

---

### Task 34: Favorites feature (local)

**Files:**
- Create: `lib/features/favorites/data/favorites_storage.dart`
- Create: `lib/features/favorites/presentation/cubit/favorites_cubit.dart`
- Create: `lib/features/favorites/presentation/cubit/favorites_state.dart`
- Modify: `lib/features/favorites/presentation/screens/favorites_screen.dart`

Hive box storing favorite business slugs. `FavoritesCubit` with toggle/check methods. Favorites screen shows list of saved businesses. Heart icon in business cards reads from this cubit.

---

### Task 35: Notifications screen (UI only)

**Files:**
- Modify: `lib/features/notifications/presentation/screens/notifications_screen.dart`

Mock data list: 3-4 sample notifications with icon, title, message, date. Empty state if none.

---

## Phase 8: Polish & Integration

### Task 36: Wire up DI with BlocProviders in main.dart

**Files:**
- Modify: `lib/main.dart`

Wrap `TurnlyApp` with `MultiBlocProvider` providing `AuthCubit` globally. Other cubits provided at screen level.

---

### Task 37: Final integration test

- [ ] **Step 1: Run full app**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/customer_v2
flutter run
```

- [ ] **Step 2: Test flows**

1. Onboarding → Login → Home
2. Explore businesses → Business detail → Create reservation
3. View reservations → Reservation detail → Cancel
4. Profile → Resources → Add resource
5. Favorites toggle
6. Logout → back to login

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(customer-v2): complete v2 customer app"
```
