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
