import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../auth/infrastructure/auth_repository_impl.dart';
import '../../infrastructure/settings_repository_impl.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _repo = SettingsRepositoryImpl();
  Map<String, dynamic>? _settings;
  bool _loading = true;
  String? _error;
  bool _loggingOut = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await _repo.getSettings();
    if (!mounted) return;
    setState(() {
      _loading = false;
      result.fold(
        (f) => _error = f.message,
        (data) => _settings = data,
      );
    });
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Deseas cerrar sesión?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _loggingOut = true);
    final repo = AuthRepositoryImpl();
    await repo.logout();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Configuración'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
        ],
      ),
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
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final data = _settings ?? {};
    // Try nested under 'data' key
    final tenant = (data['data'] as Map<String, dynamic>?) ?? data;

    final name = tenant['name'] as String? ?? tenant['business_name'] as String? ?? '-';
    final slug = tenant['slug'] as String? ?? '-';
    final plan = tenant['plan'] as String? ?? tenant['plan_name'] as String? ?? '-';
    final status = tenant['status'] as String? ?? '-';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Información del negocio', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _InfoRow(label: 'Nombre', value: name),
                const Divider(height: 24),
                _InfoRow(label: 'Slug', value: slug),
                const Divider(height: 24),
                _InfoRow(
                  label: 'Plan',
                  value: '',
                  trailing: _PlanBadge(plan: plan),
                ),
                const Divider(height: 24),
                _InfoRow(
                  label: 'Estado',
                  value: '',
                  trailing: _StatusBadge(status: status),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 32),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _loggingOut ? null : _logout,
            icon: _loggingOut
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.red))
                : const Icon(Icons.logout, color: Colors.red),
            label: const Text('Cerrar sesión', style: TextStyle(color: Colors.red)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Colors.red),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final Widget? trailing;

  const _InfoRow({required this.label, required this.value, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
        trailing ?? Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      ],
    );
  }
}

class _PlanBadge extends StatelessWidget {
  final String plan;

  const _PlanBadge({required this.plan});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.blue.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        plan,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.blue),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  Color get _color {
    switch (status.toLowerCase()) {
      case 'active':
      case 'activo':
        return Colors.green;
      case 'suspended':
      case 'suspendido':
        return Colors.red;
      case 'trial':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  String get _label {
    switch (status.toLowerCase()) {
      case 'active':
        return 'Activo';
      case 'suspended':
        return 'Suspendido';
      case 'trial':
        return 'Prueba';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        _label,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _color),
      ),
    );
  }
}
