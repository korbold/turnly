import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../../shared/enums/user_role.dart';
import '../../domain/entities/service.dart';
import '../../infrastructure/service_repository_impl.dart';

class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key});

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> {
  final _repo = ServiceRepositoryImpl();
  List<Service> _services = [];
  bool _loading = true;
  String? _error;
  UserRole _role = UserRole.washer;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final roleStr = await SecureStorage.getRole();
    if (mounted) {
      setState(() {
        _role = roleStr != null ? UserRole.fromString(roleStr) : UserRole.washer;
      });
    }
    await _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await _repo.getAll();
    if (!mounted) return;
    setState(() {
      _loading = false;
      result.fold(
        (f) => _error = f.message,
        (list) => _services = list,
      );
    });
  }

  Future<void> _deleteService(Service service) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar servicio'),
        content: Text('¿Deseas eliminar "${service.name}"? Esta acción no se puede deshacer.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final result = await _repo.delete(service.id);
    if (!mounted) return;
    result.fold(
      (f) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message))),
      (_) => _loadData(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Servicios'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
        ],
      ),
      floatingActionButton: _role.isAdmin
          ? FloatingActionButton(
              onPressed: () async {
                await context.push('/services/form');
                _loadData();
              },
              child: const Icon(Icons.add),
            )
          : null,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _loadData, child: const Text('Reintentar')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: _services.isEmpty
                      ? ListView(
                          children: [
                            SizedBox(
                              height: 300,
                              child: Center(
                                child: Text(
                                  'No hay servicios registrados',
                                  style: TextStyle(color: Colors.grey.shade600),
                                ),
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                          itemCount: _services.length,
                          itemBuilder: (context, index) {
                            final service = _services[index];
                            return _ServiceCard(
                              service: service,
                              isAdmin: _role.isAdmin,
                              onEdit: _role.isAdmin
                                  ? () async {
                                      await context.push('/services/form', extra: service);
                                      _loadData();
                                    }
                                  : null,
                              onDelete: _role.isAdmin ? () => _deleteService(service) : null,
                            );
                          },
                        ),
                ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final Service service;
  final bool isAdmin;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const _ServiceCard({
    required this.service,
    required this.isAdmin,
    this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final card = Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        title: Row(
          children: [
            Expanded(
              child: Text(service.name, style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: service.isActive ? Colors.green.withValues(alpha: 0.15) : Colors.grey.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                service.isActive ? 'Activo' : 'Inactivo',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: service.isActive ? Colors.green.shade700 : Colors.grey.shade600,
                ),
              ),
            ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (service.description != null && service.description!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(service.description!, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            ],
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.attach_money, size: 16, color: Colors.green),
                Text(
                  '\$${service.price.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.green),
                ),
                const SizedBox(width: 16),
                const Icon(Icons.timer, size: 16, color: Colors.blue),
                const SizedBox(width: 2),
                Text('${service.durationMinutes} min', style: const TextStyle(color: Colors.blue)),
              ],
            ),
          ],
        ),
        onTap: isAdmin ? onEdit : null,
        trailing: isAdmin
            ? PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'edit') onEdit?.call();
                  if (value == 'delete') onDelete?.call();
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'edit', child: Text('Editar')),
                  PopupMenuItem(value: 'delete', child: Text('Eliminar', style: TextStyle(color: Colors.red))),
                ],
              )
            : null,
      ),
    );

    if (!isAdmin) return card;

    return Dismissible(
      key: Key(service.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        color: Colors.red,
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      confirmDismiss: (_) async {
        onDelete?.call();
        return false;
      },
      child: card,
    );
  }
}
