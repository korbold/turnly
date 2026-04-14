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
