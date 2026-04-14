# Turnly Customer App UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 12 screens of the Turnly customer Flutter app with a "Clean & Bold" modern UI.

**Architecture:** Pure frontend redesign — no backend changes. New theme system with card shadows, floating bottom nav, category colors. New shared widgets for reuse across screens. Each screen gets updated independently.

**Tech Stack:** Flutter 3.x, Material 3, Dart, existing packages (dio, go_router, riverpod, intl, fpdart)

**Spec:** `docs/superpowers/specs/2026-04-13-turnly-customer-ui-redesign.md`

**Base path:** `apps/customer/lib`

---

### Task 1: Theme System + Category Colors

**Files:**
- Rewrite: `core/theme/app_theme.dart`
- Create: `core/theme/category_colors.dart`

- [ ] **Step 1: Rewrite `app_theme.dart` with new design system**

```dart
// core/theme/app_theme.dart
import 'package:flutter/material.dart';

class AppColors {
  static const primary = Color(0xFF396AFF);
  static const darkText = Color(0xFF343C6A);
  static const bodyText = Color(0xFF718EBF);
  static const background = Color(0xFFF5F7FA);
  static const surface = Colors.white;
  static const surfaceVariant = Color(0xFFF0F4FF);
  static const border = Color(0xFFDFE5EE);
  static const accent = Color(0xFFE7EDFF);
  static const success = Color(0xFF41D4A8);
  static const warning = Color(0xFFFFBB38);
  static const error = Color(0xFFFF4B4A);

  static const cardShadow = [
    BoxShadow(
      color: Color(0x14000000),
      blurRadius: 20,
      offset: Offset(0, 4),
    ),
  ];

  static const buttonShadow = [
    BoxShadow(
      color: Color(0x40396AFF),
      blurRadius: 12,
      offset: Offset(0, 4),
    ),
  ];
}

class AppTheme {
  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        brightness: Brightness.light,
        primary: AppColors.primary,
        onPrimary: Colors.white,
        surface: AppColors.surface,
        onSurface: AppColors.darkText,
      ),
      appBarTheme: const AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.darkText,
        titleTextStyle: TextStyle(
          color: AppColors.darkText,
          fontSize: 22,
          fontWeight: FontWeight.w700,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        color: AppColors.surface,
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: const TextStyle(color: AppColors.bodyText, fontSize: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 54),
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(double.infinity, 54),
          foregroundColor: AppColors.darkText,
          side: const BorderSide(color: AppColors.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
        ),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 0.5),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(color: AppColors.darkText, fontWeight: FontWeight.w700),
        headlineMedium: TextStyle(color: AppColors.darkText, fontWeight: FontWeight.w700),
        headlineSmall: TextStyle(color: AppColors.darkText, fontWeight: FontWeight.w700),
        titleLarge: TextStyle(color: AppColors.darkText, fontWeight: FontWeight.w600),
        titleMedium: TextStyle(color: AppColors.darkText, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(color: AppColors.darkText),
        bodyMedium: TextStyle(color: AppColors.bodyText),
        bodySmall: TextStyle(color: AppColors.bodyText),
        labelLarge: TextStyle(color: AppColors.darkText, fontWeight: FontWeight.w600),
      ),
    );
  }
}
```

- [ ] **Step 2: Create `category_colors.dart`**

```dart
// core/theme/category_colors.dart
import 'package:flutter/material.dart';

class CategoryStyle {
  final Color background;
  final Color iconColor;
  final IconData icon;
  final String label;

  const CategoryStyle({
    required this.background,
    required this.iconColor,
    required this.icon,
    required this.label,
  });
}

class CategoryColors {
  static const _styles = <String, CategoryStyle>{
    'car_wash': CategoryStyle(
      background: Color(0xFFDBEAFE),
      iconColor: Color(0xFF2563EB),
      icon: Icons.local_car_wash,
      label: 'Lavado de autos',
    ),
    'barbershop': CategoryStyle(
      background: Color(0xFFFFEDD5),
      iconColor: Color(0xFFEA580C),
      icon: Icons.content_cut,
      label: 'Barberia',
    ),
    'spa': CategoryStyle(
      background: Color(0xFFD1FAE5),
      iconColor: Color(0xFF059669),
      icon: Icons.spa,
      label: 'Spa',
    ),
    'gym': CategoryStyle(
      background: Color(0xFFFEE2E2),
      iconColor: Color(0xFFDC2626),
      icon: Icons.fitness_center,
      label: 'Gimnasio',
    ),
    'medical': CategoryStyle(
      background: Color(0xFFEDE9FE),
      iconColor: Color(0xFF7C3AED),
      icon: Icons.medical_services,
      label: 'Clinica',
    ),
  };

  static const _default = CategoryStyle(
    background: Color(0xFFE7EDFF),
    iconColor: Color(0xFF396AFF),
    icon: Icons.store,
    label: 'Negocio',
  );

  static CategoryStyle get(String? type) => _styles[type] ?? _default;

  static List<MapEntry<String?, CategoryStyle>> get allWithDefault => [
    const MapEntry(null, CategoryStyle(
      background: Color(0xFFE7EDFF),
      iconColor: Color(0xFF396AFF),
      icon: Icons.apps,
      label: 'Todos',
    )),
    ..._styles.entries,
  ];
}
```

- [ ] **Step 3: Verify app compiles**

Run: `cd apps/customer && flutter analyze --no-fatal-infos 2>&1 | tail -5`
Expected: No errors (warnings OK)

- [ ] **Step 4: Commit**

```bash
git add apps/customer/lib/core/theme/
git commit -m "feat(customer): redesign theme system with shadows, category colors"
```

---

### Task 2: Shared Widgets

**Files:**
- Create: `shared/widgets/date_selector.dart`
- Create: `shared/widgets/step_indicator.dart`

- [ ] **Step 1: Create `date_selector.dart`**

```dart
// shared/widgets/date_selector.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';

class DateSelector extends StatelessWidget {
  final DateTime selectedDate;
  final ValueChanged<DateTime> onDateSelected;
  final VoidCallback? onMorePressed;
  final int dayCount;

  const DateSelector({
    super.key,
    required this.selectedDate,
    required this.onDateSelected,
    this.onMorePressed,
    this.dayCount = 7,
  });

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final dates = List.generate(dayCount, (i) {
      final d = today.add(Duration(days: i));
      return DateTime(d.year, d.month, d.day);
    });

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppColors.cardShadow,
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(
          children: [
            ...dates.map((date) {
              final isSelected = date.year == selectedDate.year &&
                  date.month == selectedDate.month &&
                  date.day == selectedDate.day;
              final isToday = date.year == today.year &&
                  date.month == today.month &&
                  date.day == today.day;
              final dayAbbr = DateFormat('EEE', 'es').format(date).substring(0, 3);
              final dayNum = date.day.toString();

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: GestureDetector(
                  onTap: () => onDateSelected(date),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: 52,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.primary : Colors.transparent,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          dayAbbr,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: isSelected ? Colors.white70 : AppColors.bodyText,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          dayNum,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: isSelected ? Colors.white : AppColors.darkText,
                          ),
                        ),
                        if (isToday) ...[
                          const SizedBox(height: 4),
                          Container(
                            width: 5,
                            height: 5,
                            decoration: BoxDecoration(
                              color: isSelected ? Colors.white : AppColors.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            }),
            if (onMorePressed != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: GestureDetector(
                  onTap: onMorePressed,
                  child: Container(
                    width: 52,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.more_horiz, color: AppColors.bodyText),
                        SizedBox(height: 6),
                        Text('Mas', style: TextStyle(fontSize: 11, color: AppColors.bodyText)),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Create `step_indicator.dart`**

```dart
// shared/widgets/step_indicator.dart
import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class StepIndicator extends StatelessWidget {
  final List<String> labels;
  final int currentStep;

  const StepIndicator({
    super.key,
    required this.labels,
    required this.currentStep,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: List.generate(labels.length * 2 - 1, (i) {
          if (i.isOdd) {
            final stepBefore = i ~/ 2;
            return Expanded(
              child: Container(
                height: 2,
                color: stepBefore < currentStep ? AppColors.primary : AppColors.border,
              ),
            );
          }
          final stepIndex = i ~/ 2;
          final isCompleted = stepIndex < currentStep;
          final isActive = stepIndex == currentStep;

          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: isCompleted || isActive ? AppColors.primary : Colors.transparent,
                  shape: BoxShape.circle,
                  border: !isCompleted && !isActive
                      ? Border.all(color: AppColors.border, width: 2)
                      : null,
                ),
                child: Center(
                  child: isCompleted
                      ? const Icon(Icons.check, color: Colors.white, size: 16)
                      : Text(
                          '${stepIndex + 1}',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: isActive ? Colors.white : AppColors.bodyText,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                labels[stepIndex],
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                  color: isActive || isCompleted ? AppColors.darkText : AppColors.bodyText,
                ),
              ),
            ],
          );
        }),
      ),
    );
  }
}
```

- [ ] **Step 3: Verify app compiles**

Run: `cd apps/customer && flutter analyze --no-fatal-infos 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/customer/lib/shared/widgets/date_selector.dart apps/customer/lib/shared/widgets/step_indicator.dart
git commit -m "feat(customer): add DateSelector and StepIndicator widgets"
```

---

### Task 3: Home Screen + Floating Bottom Nav

**Files:**
- Rewrite: `features/home/presentation/screens/home_screen.dart`

- [ ] **Step 1: Rewrite `home_screen.dart`**

Replace the entire file with the new design. Key changes:
- Floating bottom nav bar with shadow and border radius
- ExploreTab: custom header with greeting, category chips, redesigned business cards
- Category filtering via `business_type` field

```dart
// features/home/presentation/screens/home_screen.dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/category_colors.dart';
import '../../../reservations/presentation/screens/reservations_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  void _goToExplore() => setState(() => _currentIndex = 0);

  late final _screens = [
    const _ExploreTab(),
    ReservationsScreen(onNewReservation: _goToExplore),
    const ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      extendBody: true,
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(20, 0, 20, 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(24),
          boxShadow: AppColors.cardShadow,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: NavigationBar(
            height: 64,
            backgroundColor: Colors.transparent,
            elevation: 0,
            indicatorColor: Colors.transparent,
            selectedIndex: _currentIndex,
            onDestinationSelected: (i) => setState(() => _currentIndex = i),
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: [
              NavigationDestination(
                icon: Icon(Icons.explore_outlined, color: _currentIndex == 0 ? AppColors.primary : AppColors.bodyText),
                selectedIcon: const Icon(Icons.explore, color: AppColors.primary),
                label: 'Explorar',
              ),
              NavigationDestination(
                icon: Icon(Icons.calendar_today_outlined, color: _currentIndex == 1 ? AppColors.primary : AppColors.bodyText),
                selectedIcon: const Icon(Icons.calendar_today, color: AppColors.primary),
                label: 'Mis citas',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline, color: _currentIndex == 2 ? AppColors.primary : AppColors.bodyText),
                selectedIcon: const Icon(Icons.person, color: AppColors.primary),
                label: 'Perfil',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ExploreTab extends StatefulWidget {
  const _ExploreTab();

  @override
  State<_ExploreTab> createState() => _ExploreTabState();
}

class _ExploreTabState extends State<_ExploreTab> {
  final Dio _dio = DioClient.instance;
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _businesses = [];
  bool _loading = true;
  String? _error;
  String? _selectedCategory;

  @override
  void initState() {
    super.initState();
    _loadBusinesses();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadBusinesses([String? search]) async {
    setState(() { _loading = true; _error = null; });
    try {
      final params = <String, dynamic>{'per_page': 50};
      if (search != null && search.isNotEmpty) params['search'] = search;

      final response = await _dio.get('/public/tenants', queryParameters: params);
      final data = response.data['data'] as List<dynamic>;
      if (mounted) {
        setState(() {
          _businesses = data.cast<Map<String, dynamic>>();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'No se pudieron cargar los negocios';
          _loading = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> get _filteredBusinesses {
    if (_selectedCategory == null) return _businesses;
    return _businesses.where((b) => b['business_type'] == _selectedCategory).toList();
  }

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Custom header
          Padding(
            padding: EdgeInsets.fromLTRB(20, topPadding + 16, 20, 0),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Explorar',
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.darkText),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Que servicio buscas hoy?',
                        style: TextStyle(fontSize: 14, color: AppColors.bodyText),
                      ),
                    ],
                  ),
                ),
                CircleAvatar(
                  radius: 20,
                  backgroundColor: AppColors.primary,
                  child: const Icon(Icons.person, size: 20, color: Colors.white),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Search bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: AppColors.cardShadow,
              ),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Buscar negocios...',
                  prefixIcon: const Icon(Icons.search, color: AppColors.bodyText),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            _loadBusinesses();
                          },
                        )
                      : null,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 16),
                ),
                onSubmitted: (v) => _loadBusinesses(v),
                onChanged: (v) => setState(() {}),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Category chips
          SizedBox(
            height: 38,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: CategoryColors.allWithDefault.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final entry = CategoryColors.allWithDefault[i];
                final isActive = _selectedCategory == entry.key;
                return GestureDetector(
                  onTap: () {
                    setState(() => _selectedCategory = entry.key);
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: isActive ? AppColors.primary : AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: isActive ? null : Border.all(color: AppColors.border, width: 0.5),
                    ),
                    child: Text(
                      entry.value.label,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: isActive ? Colors.white : AppColors.darkText,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 16),

          // Content
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_error!, style: const TextStyle(color: AppColors.bodyText)),
                            const SizedBox(height: 12),
                            OutlinedButton(onPressed: () => _loadBusinesses(), child: const Text('Reintentar')),
                          ],
                        ),
                      )
                    : _filteredBusinesses.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.store_outlined, size: 72, color: AppColors.border),
                                const SizedBox(height: 16),
                                const Text('No hay negocios', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                                const SizedBox(height: 4),
                                const Text('Intenta con otra busqueda', style: TextStyle(fontSize: 14, color: AppColors.bodyText)),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: () => _loadBusinesses(_searchController.text),
                            child: ListView.builder(
                              padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                              itemCount: _filteredBusinesses.length,
                              itemBuilder: (context, i) {
                                final business = _filteredBusinesses[i];
                                final type = business['business_type'] as String?;
                                final style = CategoryColors.get(type);
                                return _BusinessCard(
                                  business: business,
                                  categoryStyle: style,
                                  onTap: () {
                                    final slug = business['slug'] as String;
                                    context.push('/business/$slug');
                                  },
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _BusinessCard extends StatelessWidget {
  final Map<String, dynamic> business;
  final CategoryStyle categoryStyle;
  final VoidCallback onTap;

  const _BusinessCard({
    required this.business,
    required this.categoryStyle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = business['name'] as String? ?? 'Sin nombre';
    final description = business['description'] as String?;
    final address = business['address'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            boxShadow: AppColors.cardShadow,
          ),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: categoryStyle.background,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(categoryStyle.icon, size: 26, color: categoryStyle.iconColor),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: categoryStyle.background,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        categoryStyle.label,
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: categoryStyle.iconColor),
                      ),
                    ),
                    if (description != null && description.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: AppColors.bodyText),
                      ),
                    ],
                    if (address != null && address.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.location_on_outlined, size: 13, color: AppColors.bodyText),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              address,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 11, color: AppColors.bodyText),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.bodyText),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Verify app compiles and renders**

Run: `cd apps/customer && flutter analyze --no-fatal-infos 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/customer/lib/features/home/presentation/screens/home_screen.dart
git commit -m "feat(customer): redesign Explore tab with floating nav, category chips, card shadows"
```

---

### Task 4: Business Detail Screen

**Files:**
- Rewrite: `features/home/presentation/screens/business_detail_screen.dart`

- [ ] **Step 1: Rewrite `business_detail_screen.dart`**

Key changes: hero header with gradient, collapsible availability, pill "Reservar" buttons, service price in surfaceVariant pill.

```dart
// features/home/presentation/screens/business_detail_screen.dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/category_colors.dart';

class BusinessDetailScreen extends StatefulWidget {
  final String slug;
  const BusinessDetailScreen({super.key, required this.slug});

  @override
  State<BusinessDetailScreen> createState() => _BusinessDetailScreenState();
}

class _BusinessDetailScreenState extends State<BusinessDetailScreen> {
  final Dio _dio = DioClient.instance;
  Map<String, dynamic>? _tenant;
  List<Map<String, dynamic>> _services = [];
  List<Map<String, dynamic>> _availability = [];
  bool _loading = true;
  String? _error;
  bool _hoursExpanded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final response = await _dio.get('/public/tenants/${widget.slug}');
      final data = response.data['data'] as Map<String, dynamic>;
      if (mounted) {
        setState(() {
          _tenant = data['tenant'] as Map<String, dynamic>?;
          _services = (data['services'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
          _availability = (data['availability'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() { _error = 'No se pudo cargar el negocio'; _loading = false; });
      }
    }
  }

  String _dayName(int day) {
    const days = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
    return day >= 0 && day < 7 ? days[day] : '?';
  }

  bool _isTodayDay(int day) {
    return (DateTime.now().weekday - 1) == day;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, style: const TextStyle(color: AppColors.bodyText)),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _load, child: const Text('Reintentar')),
            ],
          ),
        ),
      );
    }

    final businessType = _tenant?['business_type'] as String?;
    final style = CategoryColors.get(businessType);
    final name = _tenant?['name'] as String? ?? '';
    final description = _tenant?['description'] as String?;
    final address = _tenant?['address'] as String?;
    final phone = _tenant?['phone'] as String?;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // Hero header
          SliverToBoxAdapter(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [style.background.withValues(alpha: 0.4), Colors.transparent],
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Column(
                  children: [
                    // Back button
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Row(
                        children: [
                          IconButton(
                            onPressed: () => context.pop(),
                            icon: const Icon(Icons.arrow_back),
                          ),
                        ],
                      ),
                    ),
                    // Icon + info
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: style.background,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Icon(style.icon, size: 36, color: style.iconColor),
                    ),
                    const SizedBox(height: 16),
                    Text(name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.darkText)),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        color: style.background,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(style.label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: style.iconColor)),
                    ),
                    if (address != null && address.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.location_on_outlined, size: 14, color: AppColors.bodyText),
                          const SizedBox(width: 4),
                          Text(address, style: const TextStyle(fontSize: 13, color: AppColors.bodyText)),
                        ],
                      ),
                    ],
                    if (phone != null && phone.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.phone_outlined, size: 14, color: AppColors.bodyText),
                          const SizedBox(width: 4),
                          Text(phone, style: const TextStyle(fontSize: 13, color: AppColors.bodyText)),
                        ],
                      ),
                    ],
                    if (description != null && description.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          description,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 13, color: AppColors.bodyText),
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),

          // Services
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Text(
                'Servicios (${_services.length})',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.darkText),
              ),
            ),
          ),
          if (_services.isEmpty)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 20),
                child: Text('No hay servicios disponibles', style: TextStyle(color: AppColors.bodyText)),
              ),
            )
          else
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: AppColors.cardShadow,
                  ),
                  child: Column(
                    children: _services.asMap().entries.map((entry) {
                      final i = entry.key;
                      final s = entry.value;
                      final sName = s['name'] as String? ?? 'Servicio';
                      final sDesc = s['description'] as String?;
                      final price = s['price'];
                      final currency = NumberFormat.currency(locale: 'es', symbol: '\$', decimalDigits: 2);

                      return Column(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(sName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                                      if (sDesc != null && sDesc.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(sDesc, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: AppColors.bodyText)),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    if (price != null)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                        decoration: BoxDecoration(
                                          color: AppColors.surfaceVariant,
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          currency.format(double.tryParse(price.toString()) ?? 0),
                                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary),
                                        ),
                                      ),
                                    const SizedBox(height: 8),
                                    GestureDetector(
                                      onTap: () {
                                        context.push('/reservations/create', extra: {
                                          'slug': widget.slug,
                                          'service': s,
                                          'custom_fields': _tenant?['custom_fields'],
                                        });
                                      },
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                        decoration: BoxDecoration(
                                          color: AppColors.primary,
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: const Text('Reservar', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          if (i < _services.length - 1)
                            const Divider(height: 1, indent: 16, endIndent: 16),
                        ],
                      );
                    }).toList(),
                  ),
                ),
              ),
            ),

          // Availability (collapsible)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: AppColors.cardShadow,
                ),
                child: Column(
                  children: [
                    InkWell(
                      onTap: () => setState(() => _hoursExpanded = !_hoursExpanded),
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            const Text('Horarios', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                            const Spacer(),
                            Icon(_hoursExpanded ? Icons.expand_less : Icons.expand_more, color: AppColors.bodyText),
                          ],
                        ),
                      ),
                    ),
                    if (_hoursExpanded) ...[
                      const Divider(height: 1),
                      if (_availability.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(16),
                          child: Text('No hay horario configurado', style: TextStyle(color: AppColors.bodyText)),
                        )
                      else
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                          child: Column(
                            children: () {
                              final Map<int, List<Map<String, dynamic>>> grouped = {};
                              for (final slot in _availability) {
                                final day = slot['day_of_week'] as int? ?? 0;
                                grouped.putIfAbsent(day, () => []);
                                grouped[day]!.add(slot);
                              }
                              final days = grouped.keys.toList()..sort();
                              return days.map((day) {
                                final slots = grouped[day]!;
                                final times = slots.map((s) {
                                  final start = (s['start_time'] as String? ?? '').substring(0, 5);
                                  final end = (s['end_time'] as String? ?? '').substring(0, 5);
                                  return '$start - $end';
                                }).join('  /  ');
                                final isToday = _isTodayDay(day);
                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 6),
                                  child: Row(
                                    children: [
                                      if (isToday)
                                        Container(
                                          width: 6,
                                          height: 6,
                                          margin: const EdgeInsets.only(right: 8),
                                          decoration: const BoxDecoration(
                                            color: AppColors.success,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                      SizedBox(
                                        width: 80,
                                        child: Text(
                                          _dayName(day),
                                          style: TextStyle(
                                            fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
                                            color: AppColors.darkText,
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        child: Text(times, style: const TextStyle(color: AppColors.bodyText), textAlign: TextAlign.right),
                                      ),
                                    ],
                                  ),
                                );
                              }).toList();
                            }(),
                          ),
                        ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Verify app compiles**

Run: `cd apps/customer && flutter analyze --no-fatal-infos 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/customer/lib/features/home/presentation/screens/business_detail_screen.dart
git commit -m "feat(customer): redesign business detail with hero header, collapsible hours"
```

---

### Task 5: Auth Screens (Login + Register)

**Files:**
- Rewrite: `features/auth/presentation/screens/login_screen.dart`
- Rewrite: `features/auth/presentation/screens/register_screen.dart`

- [ ] **Step 1: Rewrite `login_screen.dart`**

Key changes: top-aligned, "Turnly" as text brand (28px bold primary), tagline, divider with "o", "Crear cuenta" as outlined button.

```dart
// features/auth/presentation/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../infrastructure/auth_repository_impl.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  bool _obscurePassword = true;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });

    final repo = AuthRepositoryImpl();
    final result = await repo.login(_emailController.text, _passwordController.text);

    result.fold(
      (failure) => setState(() { _error = failure.message; _loading = false; }),
      (_) {
        if (mounted) context.go('/home');
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 80),
                const Text(
                  'Turnly',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.primary),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Reserva en segundos',
                  style: TextStyle(fontSize: 14, color: AppColors.bodyText),
                ),
                const SizedBox(height: 40),
                if (_error != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: AppColors.error, size: 18),
                        const SizedBox(width: 8),
                        Expanded(child: Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13))),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                TextFormField(
                  controller: _emailController,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    hintText: 'tu@correo.com',
                    prefixIcon: Icon(Icons.email_outlined, color: AppColors.bodyText),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  validator: (v) => v == null || v.isEmpty ? 'Email requerido' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _passwordController,
                  decoration: InputDecoration(
                    labelText: 'Contrasena',
                    prefixIcon: const Icon(Icons.lock_outline, color: AppColors.bodyText),
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: AppColors.bodyText),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  obscureText: _obscurePassword,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _login(),
                  validator: (v) => v == null || v.isEmpty ? 'Contrasena requerida' : null,
                ),
                const SizedBox(height: 28),
                Container(
                  decoration: BoxDecoration(
                    boxShadow: AppColors.buttonShadow,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: ElevatedButton(
                    onPressed: _loading ? null : _login,
                    child: _loading
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Iniciar sesion'),
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    const Expanded(child: Divider(color: AppColors.border)),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      child: Text('o', style: TextStyle(color: AppColors.bodyText, fontSize: 13)),
                    ),
                    const Expanded(child: Divider(color: AppColors.border)),
                  ],
                ),
                const SizedBox(height: 24),
                OutlinedButton(
                  onPressed: () => context.go('/register'),
                  child: const Text('Crear cuenta'),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Rewrite `register_screen.dart`**

```dart
// features/auth/presentation/screens/register_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../infrastructure/auth_repository_impl.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  bool _obscurePassword = true;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });

    final repo = AuthRepositoryImpl();
    final phone = _phoneController.text.trim();
    final result = await repo.register(
      name: _nameController.text.trim(),
      email: _emailController.text.trim(),
      password: _passwordController.text,
      phone: phone.isEmpty ? null : phone,
    );

    result.fold(
      (failure) => setState(() { _error = failure.message; _loading = false; }),
      (_) {
        if (mounted) context.go('/home');
      },
    );
  }

  double get _passwordStrength {
    final pwd = _passwordController.text;
    if (pwd.isEmpty) return 0;
    double strength = 0;
    if (pwd.length >= 6) strength += 0.25;
    if (pwd.length >= 10) strength += 0.25;
    if (RegExp(r'[A-Z]').hasMatch(pwd)) strength += 0.25;
    if (RegExp(r'[0-9!@#\$%^&*]').hasMatch(pwd)) strength += 0.25;
    return strength;
  }

  Color get _strengthColor {
    if (_passwordStrength <= 0.25) return AppColors.error;
    if (_passwordStrength <= 0.5) return AppColors.warning;
    if (_passwordStrength <= 0.75) return const Color(0xFFFB923C);
    return AppColors.success;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 80),
                const Text(
                  'Crear cuenta',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.darkText),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Completa tus datos para empezar',
                  style: TextStyle(fontSize: 14, color: AppColors.bodyText),
                ),
                const SizedBox(height: 32),
                if (_error != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: AppColors.error, size: 18),
                        const SizedBox(width: 8),
                        Expanded(child: Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13))),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Nombre',
                    prefixIcon: Icon(Icons.person_outline, color: AppColors.bodyText),
                  ),
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  validator: (v) => v == null || v.trim().isEmpty ? 'Nombre requerido' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _emailController,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.email_outlined, color: AppColors.bodyText),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  validator: (v) => v == null || v.trim().isEmpty ? 'Email requerido' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _phoneController,
                  decoration: const InputDecoration(
                    labelText: 'Telefono (opcional)',
                    prefixIcon: Icon(Icons.phone_outlined, color: AppColors.bodyText),
                  ),
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _passwordController,
                  decoration: InputDecoration(
                    labelText: 'Contrasena',
                    prefixIcon: const Icon(Icons.lock_outline, color: AppColors.bodyText),
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: AppColors.bodyText),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  obscureText: _obscurePassword,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _register(),
                  onChanged: (_) => setState(() {}),
                  validator: (v) => v == null || v.isEmpty ? 'Contrasena requerida' : null,
                ),
                if (_passwordController.text.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: List.generate(4, (i) {
                      final filled = (_passwordStrength * 4).ceil() > i;
                      return Expanded(
                        child: Container(
                          height: 4,
                          margin: EdgeInsets.only(right: i < 3 ? 4 : 0),
                          decoration: BoxDecoration(
                            color: filled ? _strengthColor : AppColors.border,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      );
                    }),
                  ),
                ],
                const SizedBox(height: 28),
                Container(
                  decoration: BoxDecoration(
                    boxShadow: AppColors.buttonShadow,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: ElevatedButton(
                    onPressed: _loading ? null : _register,
                    child: _loading
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Crear cuenta'),
                  ),
                ),
                const SizedBox(height: 20),
                Center(
                  child: TextButton(
                    onPressed: () => context.go('/login'),
                    child: const Text('Ya tenes cuenta? Inicia sesion'),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 3: Verify app compiles**

Run: `cd apps/customer && flutter analyze --no-fatal-infos 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add apps/customer/lib/features/auth/
git commit -m "feat(customer): redesign login and register screens"
```

---

### Task 6: Create Reservation Screen

**Files:**
- Rewrite: `features/reservations/presentation/screens/create_reservation_screen.dart`
- Rewrite: `features/reservations/presentation/widgets/slot_picker.dart`

- [ ] **Step 1: Rewrite `slot_picker.dart` with 3-col grid and time grouping**

```dart
// features/reservations/presentation/widgets/slot_picker.dart
import 'package:flutter/material.dart';
import '../../domain/repositories/i_reservation_repository.dart';
import '../../../../shared/extensions/date_extensions.dart';
import '../../../../core/theme/app_theme.dart';

class SlotPicker extends StatelessWidget {
  final List<AvailableSlot> slots;
  final DateTime? selected;
  final ValueChanged<DateTime> onSelected;

  const SlotPicker({
    super.key,
    required this.slots,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    if (slots.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No hay horarios disponibles.', style: TextStyle(color: AppColors.bodyText)),
        ),
      );
    }

    // Group by morning/afternoon
    final morning = slots.where((s) => s.start.hour < 12).toList();
    final afternoon = slots.where((s) => s.start.hour >= 12).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Legend
        Row(
          children: [
            _legendDot(AppColors.surface, border: AppColors.border),
            const SizedBox(width: 6),
            const Text('Disponible', style: TextStyle(fontSize: 11, color: AppColors.bodyText)),
            const SizedBox(width: 16),
            _legendDot(const Color(0xFFF5F5F5)),
            const SizedBox(width: 6),
            const Text('Ocupado', style: TextStyle(fontSize: 11, color: AppColors.bodyText)),
            const SizedBox(width: 16),
            _legendDot(AppColors.primary),
            const SizedBox(width: 6),
            const Text('Seleccionado', style: TextStyle(fontSize: 11, color: AppColors.bodyText)),
          ],
        ),
        if (morning.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('Manana', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.darkText)),
          const SizedBox(height: 8),
          _buildGrid(context, morning),
        ],
        if (afternoon.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('Tarde', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.darkText)),
          const SizedBox(height: 8),
          _buildGrid(context, afternoon),
        ],
      ],
    );
  }

  Widget _legendDot(Color color, {Color? border}) {
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: border != null ? Border.all(color: border) : null,
      ),
    );
  }

  Widget _buildGrid(BuildContext context, List<AvailableSlot> group) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 2.5,
      ),
      itemCount: group.length,
      itemBuilder: (context, i) {
        final slot = group[i];
        final isSelected = selected != null && selected!.isAtSameMomentAs(slot.start);
        final isAvailable = slot.available > 0;

        return GestureDetector(
          onTap: isAvailable ? () => onSelected(slot.start) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isSelected
                  ? AppColors.primary
                  : isAvailable
                      ? AppColors.surface
                      : const Color(0xFFF5F5F5),
              borderRadius: BorderRadius.circular(12),
              border: isSelected
                  ? null
                  : isAvailable
                      ? Border.all(color: AppColors.border)
                      : null,
              boxShadow: isSelected ? AppColors.buttonShadow : null,
            ),
            child: Text(
              slot.start.toDisplayTime(),
              style: TextStyle(
                fontSize: 14,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected
                    ? Colors.white
                    : isAvailable
                        ? AppColors.darkText
                        : AppColors.bodyText,
              ),
            ),
          ),
        );
      },
    );
  }
}
```

- [ ] **Step 2: Rewrite `create_reservation_screen.dart`**

Key changes: step indicator, horizontal date selector, grouped slots, sticky bottom summary, bottom sheet for new resource.

```dart
// features/reservations/presentation/screens/create_reservation_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/extensions/date_extensions.dart';
import '../../../../shared/widgets/date_selector.dart';
import '../../../../shared/widgets/step_indicator.dart';
import '../widgets/slot_picker.dart';
import '../../domain/repositories/i_reservation_repository.dart';

class CreateReservationScreen extends StatefulWidget {
  const CreateReservationScreen({super.key});

  @override
  State<CreateReservationScreen> createState() => _CreateReservationScreenState();
}

class _CreateReservationScreenState extends State<CreateReservationScreen> {
  final Dio _dio = DioClient.instance;
  final _notesController = TextEditingController();

  String? _slug;
  Map<String, dynamic>? _service;
  List<Map<String, dynamic>> _customFields = [];

  List<Map<String, dynamic>> _myResources = [];
  bool _loadingResources = true;
  Map<String, dynamic>? _selectedResource;
  bool _creatingNew = false;
  final Map<String, TextEditingController> _fieldControllers = {};

  DateTime _selectedDate = DateTime.now();
  DateTime? _selectedSlot;
  List<AvailableSlot> _slots = [];
  bool _loadingSlots = false;
  String? _slotsError;

  bool _submitting = false;
  String? _submitError;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final extra = GoRouterState.of(context).extra;
    if (extra is Map<String, dynamic> && _slug == null) {
      _slug = extra['slug'] as String?;
      _service = extra['service'] as Map<String, dynamic>?;
      final fields = extra['custom_fields'];
      if (fields is List) {
        _customFields = fields.cast<Map<String, dynamic>>();
        for (final field in _customFields) {
          final key = field['key'] as String? ?? '';
          _fieldControllers[key] = TextEditingController();
        }
      }
      if (_slug != null && _service != null) {
        _loadMyResources();
        _loadSlots();
      }
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    for (final c in _fieldControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  int get _currentStep {
    if (_selectedSlot != null) return 2;
    if (_slots.isNotEmpty) return 1;
    return 0;
  }

  Future<void> _loadMyResources() async {
    if (_slug == null) return;
    try {
      final response = await _dio.get('/public/tenants/$_slug/my-resources');
      final data = response.data['data'] as List<dynamic>;
      if (mounted) {
        setState(() {
          _myResources = data.cast<Map<String, dynamic>>();
          _loadingResources = false;
          if (_myResources.isNotEmpty) {
            _selectedResource = _myResources.first;
          } else if (_customFields.isNotEmpty) {
            _creatingNew = true;
          }
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loadingResources = false;
          if (_customFields.isNotEmpty) _creatingNew = true;
        });
      }
    }
  }

  Future<void> _loadSlots() async {
    if (_slug == null || _service == null) return;
    setState(() {
      _loadingSlots = true;
      _slotsError = null;
      _selectedSlot = null;
      _slots = [];
    });

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final response = await _dio.get(
        '/public/tenants/$_slug/available-slots',
        queryParameters: {
          'date': dateStr,
          'service_id': _service!['id'],
        },
      );
      final data = response.data['data'] as List<dynamic>;
      final parsed = data.map((e) {
        final map = e as Map<String, dynamic>;
        return AvailableSlot(
          start: DateTime.parse(map['start'] as String),
          end: DateTime.parse(map['end'] as String),
          available: map['available'] as int? ?? 0,
        );
      }).toList();

      if (parsed.isEmpty && _isToday(_selectedDate)) {
        setState(() {
          _selectedDate = _selectedDate.add(const Duration(days: 1));
        });
        _loadSlots();
        return;
      }

      setState(() {
        _slots = parsed;
        _loadingSlots = false;
      });
    } catch (e) {
      setState(() {
        _slotsError = 'No se pudieron cargar los horarios';
        _loadingSlots = false;
      });
    }
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month && date.day == now.day;
  }

  bool _validateResourceFields() {
    for (final field in _customFields) {
      final key = field['key'] as String? ?? '';
      final required = field['required'] as bool? ?? false;
      if (required && (_fieldControllers[key]?.text.trim().isEmpty ?? true)) {
        return false;
      }
    }
    return true;
  }

  Map<String, dynamic> _buildResourceData() {
    final data = <String, dynamic>{};
    for (final field in _customFields) {
      final key = field['key'] as String? ?? '';
      final value = _fieldControllers[key]?.text.trim() ?? '';
      if (value.isNotEmpty) data[key] = value;
    }
    return data;
  }

  bool get _hasResourceSelection {
    if (_customFields.isEmpty) return true;
    if (_selectedResource != null) return true;
    if (_creatingNew && _validateResourceFields()) return true;
    return false;
  }

  Future<void> _submit() async {
    if (_slug == null || _service == null || _selectedSlot == null) return;
    setState(() { _submitting = true; _submitError = null; });

    try {
      final body = <String, dynamic>{
        'service_id': _service!['id'],
        'scheduled_at': _selectedSlot!.toIso8601String(),
        if (_notesController.text.trim().isNotEmpty)
          'notes': _notesController.text.trim(),
      };

      if (_selectedResource != null) {
        body['client_resource_id'] = _selectedResource!['id'];
      } else if (_creatingNew && _customFields.isNotEmpty) {
        body['client_resource_data'] = _buildResourceData();
      }

      await _dio.post('/public/tenants/$_slug/book', data: body);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reservacion creada exitosamente'), backgroundColor: Colors.green),
        );
        context.pop();
      }
    } on DioException catch (e) {
      final data = e.response?.data;
      String msg = 'Error al crear la reservacion';
      if (data is Map) {
        msg = data['error']?['message']?.toString() ?? data['message']?.toString() ?? msg;
      }
      setState(() { _submitError = msg; _submitting = false; });
    } catch (e) {
      setState(() { _submitError = e.toString(); _submitting = false; });
    }
  }

  void _showNewResourceSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Nuevo vehiculo', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.darkText)),
            const SizedBox(height: 16),
            ..._customFields.map((field) {
              final key = field['key'] as String? ?? '';
              final label = field['label'] as String? ?? key;
              final required = field['required'] as bool? ?? false;
              final uppercase = field['uppercase'] as bool? ?? false;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextField(
                  controller: _fieldControllers[key],
                  textCapitalization: uppercase ? TextCapitalization.characters : TextCapitalization.sentences,
                  decoration: InputDecoration(labelText: required ? '$label *' : label),
                  onChanged: (_) => setState(() {}),
                ),
              );
            }),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _validateResourceFields()
                  ? () {
                      setState(() { _creatingNew = true; _selectedResource = null; });
                      Navigator.of(ctx).pop();
                    }
                  : null,
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final serviceName = _service?['name'] as String? ?? 'Servicio';
    final servicePrice = _service?['price'];
    final currency = NumberFormat.currency(locale: 'es', symbol: '\$', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(title: const Text('Nueva Reservacion')),
      body: _slug == null || _service == null
          ? const Center(child: Text('Datos del servicio no disponibles', style: TextStyle(color: AppColors.bodyText)))
          : Column(
              children: [
                // Step indicator
                StepIndicator(labels: const ['Fecha', 'Horario', 'Confirmar'], currentStep: _currentStep),

                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
                    children: [
                      // Service info
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: AppColors.cardShadow,
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: AppColors.surfaceVariant,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: const Icon(Icons.event_available, color: AppColors.primary),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(serviceName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                                  if (servicePrice != null)
                                    Text(
                                      currency.format(double.tryParse(servicePrice.toString()) ?? 0),
                                      style: const TextStyle(fontSize: 14, color: AppColors.primary, fontWeight: FontWeight.w700),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Vehicle / Client Resource
                      if (_customFields.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        _buildResourceSection(),
                      ],

                      const SizedBox(height: 24),

                      // Date selector
                      const Text('Selecciona una fecha', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                      const SizedBox(height: 12),
                      DateSelector(
                        selectedDate: _selectedDate,
                        onDateSelected: (date) {
                          setState(() {
                            _selectedDate = date;
                            _selectedSlot = null;
                            _slots = [];
                          });
                          _loadSlots();
                        },
                        onMorePressed: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: _selectedDate,
                            firstDate: DateTime.now(),
                            lastDate: DateTime.now().add(const Duration(days: 60)),
                          );
                          if (picked != null && picked != _selectedDate) {
                            setState(() {
                              _selectedDate = picked;
                              _selectedSlot = null;
                              _slots = [];
                            });
                            _loadSlots();
                          }
                        },
                      ),

                      const SizedBox(height: 24),

                      // Time slots
                      const Text('Horarios disponibles', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                      const SizedBox(height: 12),
                      if (_loadingSlots)
                        const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
                      else if (_slotsError != null)
                        Column(
                          children: [
                            Text(_slotsError!, style: const TextStyle(color: AppColors.error)),
                            const SizedBox(height: 8),
                            TextButton(onPressed: _loadSlots, child: const Text('Reintentar')),
                          ],
                        )
                      else if (_slots.isEmpty)
                        const Text('No hay horarios disponibles para esta fecha', style: TextStyle(color: AppColors.bodyText))
                      else
                        SlotPicker(
                          slots: _slots,
                          selected: _selectedSlot,
                          onSelected: (dt) => setState(() => _selectedSlot = dt),
                        ),

                      const SizedBox(height: 24),

                      // Notes
                      TextField(
                        controller: _notesController,
                        decoration: const InputDecoration(
                          labelText: 'Notas (opcional)',
                          prefixIcon: Icon(Icons.notes, color: AppColors.bodyText),
                        ),
                        maxLines: 2,
                      ),

                      if (_submitError != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.error.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Text(_submitError!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
                        ),
                      ],
                    ],
                  ),
                ),

                // Sticky bottom summary
                if (_selectedSlot != null)
                  Container(
                    padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).padding.bottom + 16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      boxShadow: [
                        BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 20, offset: const Offset(0, -4)),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceVariant,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(serviceName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                                    Text(
                                      '${_selectedDate.toDisplayDate()} · ${_selectedSlot!.toDisplayTime()}',
                                      style: const TextStyle(fontSize: 12, color: AppColors.bodyText),
                                    ),
                                  ],
                                ),
                              ),
                              if (servicePrice != null)
                                Text(
                                  currency.format(double.tryParse(servicePrice.toString()) ?? 0),
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.primary),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          decoration: BoxDecoration(
                            boxShadow: AppColors.buttonShadow,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: ElevatedButton(
                            onPressed: !_submitting && _hasResourceSelection ? _submit : null,
                            child: _submitting
                                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Text('Confirmar reservacion'),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _buildResourceSection() {
    if (_loadingResources) {
      return const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Tu vehiculo', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
        const SizedBox(height: 12),
        if (_myResources.isNotEmpty) ...[
          ..._myResources.map((r) => _buildResourceOption(r)),
          const SizedBox(height: 8),
          _buildNewResourceOption(),
        ],
        if (_creatingNew && _myResources.isEmpty)
          _buildInlineResourceInfo(),
      ],
    );
  }

  Widget _buildResourceOption(Map<String, dynamic> resource) {
    final isSelected = _selectedResource?['id'] == resource['id'];
    final data = resource['data'] as Map<String, dynamic>? ?? {};
    final parts = <String>[];
    for (final field in _customFields) {
      final key = field['key'] as String? ?? '';
      final value = data[key]?.toString();
      if (value != null && value.isNotEmpty) parts.add(value);
    }
    final displayLabel = parts.isNotEmpty ? parts.join(' · ') : 'Vehiculo';

    return GestureDetector(
      onTap: () => setState(() { _selectedResource = resource; _creatingNew = false; }),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.accent : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isSelected ? AppColors.primary : AppColors.border, width: isSelected ? 2 : 1),
        ),
        child: Row(
          children: [
            Icon(Icons.directions_car, color: isSelected ? AppColors.primary : AppColors.bodyText, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Text(displayLabel, style: TextStyle(fontSize: 14, fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400, color: isSelected ? AppColors.primary : AppColors.darkText)),
            ),
            if (isSelected) const Icon(Icons.check_circle, color: AppColors.primary, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildNewResourceOption() {
    return GestureDetector(
      onTap: _showNewResourceSheet,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: const Row(
          children: [
            Icon(Icons.add_circle_outline, color: AppColors.bodyText, size: 24),
            SizedBox(width: 12),
            Text('Registrar nuevo vehiculo', style: TextStyle(fontSize: 14, color: AppColors.darkText)),
          ],
        ),
      ),
    );
  }

  Widget _buildInlineResourceInfo() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.primary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Necesitas registrar un vehiculo', style: TextStyle(fontSize: 13, color: AppColors.darkText)),
                const SizedBox(height: 4),
                GestureDetector(
                  onTap: _showNewResourceSheet,
                  child: const Text('Agregar vehiculo', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 3: Verify app compiles**

Run: `cd apps/customer && flutter analyze --no-fatal-infos 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add apps/customer/lib/features/reservations/presentation/
git commit -m "feat(customer): redesign create reservation with date selector, grouped slots, sticky summary"
```

---

### Task 7: Reservations List + Card + Status Badge

**Files:**
- Rewrite: `features/reservations/presentation/screens/reservations_screen.dart`
- Rewrite: `features/reservations/presentation/widgets/reservation_card.dart`
- Modify: `features/reservations/presentation/widgets/status_badge.dart`

- [ ] **Step 1: Update `status_badge.dart` — minor style tweak**

```dart
// features/reservations/presentation/widgets/status_badge.dart
import 'package:flutter/material.dart';
import '../../domain/enums/reservation_status.dart';

class StatusBadge extends StatelessWidget {
  final ReservationStatus status;
  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: status.color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: status.color,
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Rewrite `reservation_card.dart`**

```dart
// features/reservations/presentation/widgets/reservation_card.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/reservation.dart';
import '../../../../shared/extensions/date_extensions.dart';
import '../../../../core/theme/app_theme.dart';
import 'status_badge.dart';

class ReservationCard extends StatelessWidget {
  final Reservation reservation;
  final VoidCallback? onTap;
  final bool isHighlighted;

  const ReservationCard({
    super.key,
    required this.reservation,
    this.onTap,
    this.isHighlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    final dayNum = reservation.scheduledAt.day.toString();
    final month = DateFormat('MMM', 'es').format(reservation.scheduledAt);
    final time = reservation.scheduledAt.toDisplayTime();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            boxShadow: AppColors.cardShadow,
            border: isHighlighted ? Border.all(color: AppColors.primary, width: 1.5) : null,
          ),
          child: Row(
            children: [
              // Date block
              Column(
                children: [
                  Text(dayNum, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.darkText)),
                  Text(month, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                ],
              ),
              const SizedBox(width: 16),
              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (reservation.tenantName != null)
                      Text(reservation.tenantName!, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                    if (reservation.serviceName != null)
                      Text(reservation.serviceName!, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                    const SizedBox(height: 4),
                    Text(time, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                  ],
                ),
              ),
              StatusBadge(status: reservation.status),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 3: Rewrite `reservations_screen.dart`**

```dart
// features/reservations/presentation/screens/reservations_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../infrastructure/reservation_repository_impl.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';
import '../widgets/reservation_card.dart';

class ReservationsScreen extends StatefulWidget {
  final VoidCallback? onNewReservation;
  const ReservationsScreen({super.key, this.onNewReservation});

  @override
  State<ReservationsScreen> createState() => _ReservationsScreenState();
}

class _ReservationsScreenState extends State<ReservationsScreen> {
  final _repo = ReservationRepositoryImpl();
  late Future<List<Reservation>> _future;
  int _selectedFilter = 0;

  static const _filters = ['Proximas', 'Completadas', 'Canceladas'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    String? status;
    switch (_selectedFilter) {
      case 1:
        status = 'completed';
        break;
      case 2:
        status = 'cancelled';
        break;
    }
    _future = _repo
        .getAll(status: status)
        .then((result) => result.fold((f) => throw f.message, (list) {
          if (_selectedFilter == 0) {
            return list.where((r) =>
              r.status == ReservationStatus.pending ||
              r.status == ReservationStatus.confirmed ||
              r.status == ReservationStatus.inProgress
            ).toList();
          }
          return list;
        }));
  }

  void _refresh({int? filter}) {
    setState(() {
      if (filter != null) _selectedFilter = filter;
      _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mis Citas')),
      body: Column(
        children: [
          // Filter chips
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Row(
              children: List.generate(_filters.length, (i) {
                final isActive = _selectedFilter == i;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () => _refresh(filter: i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isActive ? AppColors.primary : AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: isActive ? null : Border.all(color: AppColors.border, width: 0.5),
                      ),
                      child: Text(
                        _filters[i],
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: isActive ? Colors.white : AppColors.darkText,
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),

          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => _refresh(),
              child: FutureBuilder<List<Reservation>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                          const SizedBox(height: 12),
                          Text(snapshot.error.toString(), textAlign: TextAlign.center),
                          const SizedBox(height: 16),
                          OutlinedButton(onPressed: () => _refresh(), child: const Text('Reintentar')),
                        ],
                      ),
                    );
                  }

                  final reservations = snapshot.data ?? [];
                  if (reservations.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.calendar_today, size: 72, color: AppColors.border),
                          const SizedBox(height: 16),
                          const Text('No tenes citas', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                          const SizedBox(height: 8),
                          OutlinedButton(
                            onPressed: widget.onNewReservation ?? () => context.go('/home'),
                            child: const Text('Explorar negocios'),
                          ),
                        ],
                      ),
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.only(bottom: 100),
                    itemCount: reservations.length,
                    itemBuilder: (context, i) {
                      final r = reservations[i];
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_selectedFilter == 0 && i == 0)
                            const Padding(
                              padding: EdgeInsets.fromLTRB(20, 8, 20, 4),
                              child: Text('Proxima cita', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.bodyText)),
                            ),
                          ReservationCard(
                            reservation: r,
                            isHighlighted: _selectedFilter == 0 && i == 0,
                            onTap: () => context.push('/reservations/${r.id}'),
                          ),
                        ],
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: Verify app compiles**

Run: `cd apps/customer && flutter analyze --no-fatal-infos 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add apps/customer/lib/features/reservations/
git commit -m "feat(customer): redesign reservations list with chip filters, new card layout"
```

---

### Task 8: Reservation Detail Screen

**Files:**
- Rewrite: `features/reservations/presentation/screens/reservation_detail_screen.dart`

- [ ] **Step 1: Rewrite `reservation_detail_screen.dart`**

Key changes: status header with colored bg, info sections with icon containers, sticky cancel footer.

```dart
// features/reservations/presentation/screens/reservation_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../infrastructure/reservation_repository_impl.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';
import '../../../../shared/extensions/date_extensions.dart';
import '../../../../core/theme/app_theme.dart';

class ReservationDetailScreen extends StatefulWidget {
  final String reservationId;
  const ReservationDetailScreen({super.key, required this.reservationId});

  @override
  State<ReservationDetailScreen> createState() => _ReservationDetailScreenState();
}

class _ReservationDetailScreenState extends State<ReservationDetailScreen> {
  final _repo = ReservationRepositoryImpl();
  late Future<Reservation> _future;
  bool _cancelling = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = _repo.getById(widget.reservationId).then((result) => result.fold((f) => throw f.message, (r) => r));
  }

  bool _canCancel(Reservation reservation) {
    if (reservation.status != ReservationStatus.pending && reservation.status != ReservationStatus.confirmed) return false;
    if (reservation.cancellationHours <= 0) return true;
    return reservation.scheduledAt.difference(DateTime.now()).inMinutes >= (reservation.cancellationHours * 60);
  }

  Future<void> _cancel(Reservation reservation) async {
    final controller = TextEditingController();
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Cancelar cita', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.darkText)),
            const SizedBox(height: 8),
            const Text('Estas seguro? Esta accion no se puede deshacer.', style: TextStyle(color: AppColors.bodyText)),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              decoration: const InputDecoration(labelText: 'Motivo (opcional)'),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(ctx).pop(null),
                    child: const Text('No, mantener'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                    onPressed: () => Navigator.of(ctx).pop(controller.text),
                    child: const Text('Si, cancelar'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    if (reason == null) return;

    setState(() => _cancelling = true);
    final result = await _repo.cancel(reservation.id, reason: reason.isEmpty ? null : reason);
    result.fold(
      (f) {
        setState(() => _cancelling = false);
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message), backgroundColor: AppColors.error));
      },
      (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Cita cancelada'), backgroundColor: Colors.orange));
          context.pop();
        }
      },
    );
  }

  IconData _statusIcon(ReservationStatus status) {
    switch (status) {
      case ReservationStatus.pending: return Icons.schedule;
      case ReservationStatus.confirmed: return Icons.check_circle_outline;
      case ReservationStatus.inProgress: return Icons.play_circle_outline;
      case ReservationStatus.completed: return Icons.task_alt;
      case ReservationStatus.cancelled: return Icons.cancel_outlined;
      case ReservationStatus.noShow: return Icons.person_off_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Detalle')),
      body: FutureBuilder<Reservation>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                  const SizedBox(height: 12),
                  Text(snapshot.error.toString(), textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  OutlinedButton(onPressed: () => setState(_load), child: const Text('Reintentar')),
                ],
              ),
            );
          }

          final r = snapshot.data!;
          final canCancel = _canCancel(r);

          return Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  child: Column(
                    children: [
                      // Status header
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        decoration: BoxDecoration(
                          color: r.status.color.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Column(
                          children: [
                            Icon(_statusIcon(r.status), size: 40, color: r.status.color),
                            const SizedBox(height: 8),
                            Text(r.status.label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: r.status.color)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Info sections
                      _infoRow(Icons.calendar_today, AppColors.primary, 'Cuando', r.scheduledAt.toDisplayDateTime()),
                      if (r.tenantName != null) _infoRow(Icons.store, const Color(0xFF059669), 'Donde', r.tenantName!),
                      _infoRow(Icons.build_outlined, const Color(0xFF8B5CF6), 'Servicio', '${r.serviceName ?? "-"}${r.servicePrice != null ? "  ·  \$${r.servicePrice}" : ""}'),
                      if (r.clientResourceId != null) _infoRow(Icons.directions_car, const Color(0xFF2563EB), 'Recurso', r.clientResourceLabel ?? 'Recurso'),
                      if (r.assignedTo != null) _infoRow(Icons.person_pin, const Color(0xFFEA580C), 'Atendido por', r.assignedTo!),
                      if (r.notes != null && r.notes!.isNotEmpty) _infoRow(Icons.notes, AppColors.bodyText, 'Notas', r.notes!),
                    ],
                  ),
                ),
              ),

              // Cancel footer
              if (canCancel)
                Container(
                  padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).padding.bottom + 16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, -2))],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: _cancelling ? null : () => _cancel(r),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.error,
                            side: const BorderSide(color: AppColors.error),
                          ),
                          child: _cancelling
                              ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Text('Cancelar cita'),
                        ),
                      ),
                      if (r.cancellationHours > 0) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Puedes cancelar hasta ${r.cancellationHours} ${r.cancellationHours == 1 ? "hora" : "horas"} antes',
                          style: const TextStyle(fontSize: 12, color: AppColors.bodyText),
                        ),
                      ],
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _infoRow(IconData icon, Color color, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.darkText)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Verify app compiles**

Run: `cd apps/customer && flutter analyze --no-fatal-infos 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/customer/lib/features/reservations/presentation/screens/reservation_detail_screen.dart
git commit -m "feat(customer): redesign reservation detail with status header, info sections, sticky footer"
```

---

### Task 9: Profile Screen

**Files:**
- Rewrite: `features/home/presentation/screens/profile_screen.dart`

- [ ] **Step 1: Rewrite `profile_screen.dart`**

```dart
// features/home/presentation/screens/profile_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../../core/theme/app_theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Perfil')),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          children: [
            const SizedBox(height: 24),
            // Avatar
            CircleAvatar(
              radius: 36,
              backgroundColor: AppColors.primary,
              child: const Text('U', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
            const SizedBox(height: 16),
            const Text('Usuario', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.darkText)),
            const SizedBox(height: 32),

            // Options
            _ProfileOption(
              icon: Icons.directions_car,
              iconBg: const Color(0xFFDBEAFE),
              iconColor: const Color(0xFF2563EB),
              label: 'Mis vehiculos',
              onTap: () => context.push('/client-resources'),
            ),
            const SizedBox(height: 12),
            _ProfileOption(
              icon: Icons.notifications_outlined,
              iconBg: const Color(0xFFFFEDD5),
              iconColor: const Color(0xFFEA580C),
              label: 'Notificaciones',
              onTap: () {},
            ),
            const SizedBox(height: 12),
            _ProfileOption(
              icon: Icons.help_outline,
              iconBg: const Color(0xFFD1FAE5),
              iconColor: const Color(0xFF059669),
              label: 'Ayuda',
              onTap: () {},
            ),

            const Spacer(),

            TextButton(
              onPressed: () async {
                await SecureStorage.clear();
                if (context.mounted) context.go('/login');
              },
              child: const Text('Cerrar sesion', style: TextStyle(color: AppColors.error, fontWeight: FontWeight.w500)),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _ProfileOption extends StatelessWidget {
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String label;
  final VoidCallback onTap;

  const _ProfileOption({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: AppColors.cardShadow,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: iconColor),
            ),
            const SizedBox(width: 14),
            Expanded(child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.darkText))),
            const Icon(Icons.chevron_right, color: AppColors.bodyText),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Verify and commit**

```bash
cd apps/customer && flutter analyze --no-fatal-infos 2>&1 | tail -5
git add apps/customer/lib/features/home/presentation/screens/profile_screen.dart
git commit -m "feat(customer): redesign profile screen with colored icon options"
```

---

### Task 10: Client Resources Screens

**Files:**
- Rewrite: `features/client_resources/presentation/screens/client_resources_screen.dart`
- Rewrite: `features/client_resources/presentation/screens/client_resource_history_screen.dart`

- [ ] **Step 1: Rewrite `client_resources_screen.dart`**

```dart
// features/client_resources/presentation/screens/client_resources_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../domain/entities/client_resource.dart';
import '../../infrastructure/client_resource_repository_impl.dart';
import '../../../../core/theme/app_theme.dart';

class ClientResourcesScreen extends StatefulWidget {
  const ClientResourcesScreen({super.key});

  @override
  State<ClientResourcesScreen> createState() => _ClientResourcesScreenState();
}

class _ClientResourcesScreenState extends State<ClientResourcesScreen> {
  final _repo = ClientResourceRepositoryImpl();
  List<ClientResource> _resources = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final result = await _repo.getAll();
    if (!mounted) return;
    result.fold(
      (failure) => setState(() { _error = failure.message; _loading = false; }),
      (resources) => setState(() { _resources = resources; _loading = false; }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mis Recursos')),
      body: Builder(builder: (_) {
        if (_loading) return const Center(child: CircularProgressIndicator());
        if (_error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(_error!, style: const TextStyle(color: AppColors.error)),
                const SizedBox(height: 16),
                OutlinedButton(onPressed: _load, child: const Text('Reintentar')),
              ],
            ),
          );
        }
        if (_resources.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.directions_car_outlined, size: 72, color: AppColors.border),
                const SizedBox(height: 16),
                const Text('No tenes recursos registrados', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () async {
                    await context.push('/client-resources/add');
                    _load();
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Agregar'),
                ),
              ],
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: _load,
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
            itemCount: _resources.length,
            itemBuilder: (context, index) {
              final r = _resources[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: GestureDetector(
                  onTap: () => context.push('/client-resources/${r.id}/history', extra: r.label),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: AppColors.cardShadow,
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: const Color(0xFFDBEAFE),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.directions_car, size: 22, color: Color(0xFF2563EB)),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(r.label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                        ),
                        const Icon(Icons.chevron_right, color: AppColors.bodyText),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        );
      }),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await context.push('/client-resources/add');
          _load();
        },
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}
```

- [ ] **Step 2: Rewrite `client_resource_history_screen.dart` with timeline**

```dart
// features/client_resources/presentation/screens/client_resource_history_screen.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/wash_history_entry.dart';
import '../../infrastructure/client_resource_repository_impl.dart';
import '../../../../core/theme/app_theme.dart';

class ClientResourceHistoryScreen extends StatefulWidget {
  final String clientResourceId;
  final String label;

  const ClientResourceHistoryScreen({
    super.key,
    required this.clientResourceId,
    required this.label,
  });

  @override
  State<ClientResourceHistoryScreen> createState() => _ClientResourceHistoryScreenState();
}

class _ClientResourceHistoryScreenState extends State<ClientResourceHistoryScreen> {
  final _repo = ClientResourceRepositoryImpl();
  List<WashHistoryEntry> _entries = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final result = await _repo.getHistory(widget.clientResourceId);
    if (!mounted) return;
    result.fold(
      (failure) => setState(() { _error = failure.message; _loading = false; }),
      (entries) => setState(() { _entries = entries; _loading = false; }),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'completed': return AppColors.success;
      case 'in_progress': return const Color(0xFF3B82F6);
      case 'cancelled': return AppColors.error;
      default: return AppColors.bodyText;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'completed': return 'Completado';
      case 'in_progress': return 'En proceso';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Historial - ${widget.label}')),
      body: Builder(builder: (_) {
        if (_loading) return const Center(child: CircularProgressIndicator());
        if (_error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(_error!, style: const TextStyle(color: AppColors.error)),
                const SizedBox(height: 16),
                OutlinedButton(onPressed: _load, child: const Text('Reintentar')),
              ],
            ),
          );
        }
        if (_entries.isEmpty) {
          return const Center(child: Text('Este recurso aun no tiene historial.', style: TextStyle(color: AppColors.bodyText)));
        }
        return RefreshIndicator(
          onRefresh: _load,
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            itemCount: _entries.length,
            itemBuilder: (context, index) {
              final entry = _entries[index];
              final isLast = index == _entries.length - 1;
              final color = _statusColor(entry.status);
              final dateFormat = DateFormat('dd MMM yyyy, HH:mm', 'es');
              final currency = NumberFormat.currency(symbol: '\$', decimalDigits: 2);

              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Timeline
                    SizedBox(
                      width: 24,
                      child: Column(
                        children: [
                          Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                            ),
                          ),
                          if (!isLast)
                            Expanded(
                              child: Container(
                                width: 2,
                                color: AppColors.border,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Content
                    Expanded(
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: AppColors.cardShadow,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(entry.serviceName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(_statusLabel(entry.status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(dateFormat.format(entry.startedAt), style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(entry.paymentMethod, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.surfaceVariant,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    currency.format(entry.priceCharged),
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      }),
    );
  }
}
```

- [ ] **Step 3: Verify app compiles**

Run: `cd apps/customer && flutter analyze --no-fatal-infos 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add apps/customer/lib/features/client_resources/
git commit -m "feat(customer): redesign client resources with card shadows, timeline history"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Run full analyzer**

Run: `cd apps/customer && flutter analyze --no-fatal-infos 2>&1 | tail -10`
Expected: No errors

- [ ] **Step 2: Build APK to verify no runtime issues**

Run: `cd apps/customer && flutter build apk --debug 2>&1 | tail -5`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Final commit with any fixes**

If any analyzer issues were found and fixed:
```bash
git add -A apps/customer/lib/
git commit -m "fix(customer): resolve analyzer issues from UI redesign"
```
