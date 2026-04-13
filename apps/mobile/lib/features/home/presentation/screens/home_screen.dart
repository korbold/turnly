import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../reservations/presentation/screens/reservations_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final _screens = const [
    _ExploreTab(),
    ReservationsScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.border, width: 0.5)),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (i) => setState(() => _currentIndex = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Explorar'),
            NavigationDestination(icon: Icon(Icons.calendar_today_outlined), selectedIcon: Icon(Icons.calendar_today), label: 'Mis citas'),
            NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Perfil'),
          ],
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

  IconData _getBusinessIcon(String? type) {
    switch (type) {
      case 'car_wash': return Icons.local_car_wash;
      case 'barbershop': return Icons.content_cut;
      case 'spa': return Icons.spa;
      case 'gym': return Icons.fitness_center;
      case 'medical': return Icons.medical_services;
      default: return Icons.store;
    }
  }

  String _getBusinessTypeLabel(String? type) {
    switch (type) {
      case 'car_wash': return 'Lavado de autos';
      case 'barbershop': return 'Barbería';
      case 'spa': return 'Spa';
      case 'gym': return 'Gimnasio';
      case 'medical': return 'Clínica';
      default: return 'Negocio';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Explorar'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.accent,
              child: const Icon(Icons.person, size: 18, color: AppColors.primary),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
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
              ),
              onSubmitted: (v) => _loadBusinesses(v),
              onChanged: (v) => setState(() {}),
            ),
          ),

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
                            OutlinedButton(onPressed: _loadBusinesses, child: const Text('Reintentar')),
                          ],
                        ),
                      )
                    : _businesses.isEmpty
                        ? const Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.store_outlined, size: 48, color: AppColors.border),
                                SizedBox(height: 12),
                                Text('No se encontraron negocios', style: TextStyle(color: AppColors.bodyText)),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: () => _loadBusinesses(_searchController.text),
                            child: ListView.builder(
                              padding: const EdgeInsets.symmetric(horizontal: 20),
                              itemCount: _businesses.length,
                              itemBuilder: (context, i) => _BusinessCard(
                                business: _businesses[i],
                                icon: _getBusinessIcon(_businesses[i]['business_type'] as String?),
                                typeLabel: _getBusinessTypeLabel(_businesses[i]['business_type'] as String?),
                                onTap: () {
                                  final slug = _businesses[i]['slug'] as String;
                                  context.push('/business/$slug');
                                },
                              ),
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
  final IconData icon;
  final String typeLabel;
  final VoidCallback onTap;

  const _BusinessCard({
    required this.business,
    required this.icon,
    required this.typeLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = business['name'] as String? ?? 'Sin nombre';
    final description = business['description'] as String?;
    final address = business['address'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border, width: 0.5),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, size: 24, color: AppColors.primary),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppColors.darkText,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        typeLabel,
                        style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500),
                      ),
                      if (description != null && description.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, color: AppColors.bodyText),
                        ),
                      ],
                      if (address != null && address.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.location_on_outlined, size: 12, color: AppColors.bodyText),
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
      ),
    );
  }
}
