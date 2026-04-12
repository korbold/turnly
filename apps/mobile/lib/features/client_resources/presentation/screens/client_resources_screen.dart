import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../domain/entities/client_resource.dart';
import '../../infrastructure/client_resource_repository_impl.dart';

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
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await _repo.getAll();
    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _error = failure.message;
        _loading = false;
      }),
      (resources) => setState(() {
        _resources = resources;
        _loading = false;
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mis Recursos')),
      body: Builder(builder: (_) {
        if (_loading) {
          return const Center(child: CircularProgressIndicator());
        }
        if (_error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(_error!, style: const TextStyle(color: Colors.red)),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _load,
                  child: const Text('Reintentar'),
                ),
              ],
            ),
          );
        }
        if (_resources.isEmpty) {
          return const Center(
            child: Text(
              'No tienes recursos registrados.\nAgrega uno con el botón +.',
              textAlign: TextAlign.center,
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: _load,
          child: ListView.builder(
            itemCount: _resources.length,
            itemBuilder: (context, index) {
              final r = _resources[index];
              return _ClientResourceCard(
                resource: r,
                onTap: () => context.push(
                  '/client-resources/${r.id}/history',
                  extra: r.label,
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
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _ClientResourceCard extends StatelessWidget {
  final ClientResource resource;
  final VoidCallback onTap;

  const _ClientResourceCard({required this.resource, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: ListTile(
        leading: const Icon(Icons.label, size: 36),
        title: Text(
          resource.label,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
