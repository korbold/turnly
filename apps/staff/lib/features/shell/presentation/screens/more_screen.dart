import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../auth/infrastructure/auth_repository_impl.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Más opciones')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Expanded(
              child: GridView.count(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                children: [
                  _MoreCard(
                    icon: Icons.build,
                    label: 'Servicios',
                    color: Colors.blue,
                    onTap: () => context.push('/services'),
                  ),
                  _MoreCard(
                    icon: Icons.people,
                    label: 'Equipo',
                    color: Colors.purple,
                    onTap: () => context.push('/team'),
                  ),
                  _MoreCard(
                    icon: Icons.bar_chart,
                    label: 'Reportes',
                    color: Colors.orange,
                    onTap: () => context.push('/reports'),
                  ),
                  _MoreCard(
                    icon: Icons.settings,
                    label: 'Configuración',
                    color: Colors.grey,
                    onTap: () => context.push('/settings'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  final repo = AuthRepositoryImpl();
                  await repo.logout();
                  if (context.mounted) context.go('/login');
                },
                icon: const Icon(Icons.logout, color: Colors.red),
                label: const Text('Cerrar sesión', style: TextStyle(color: Colors.red)),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _MoreCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _MoreCard({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 40, color: color),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 16)),
          ],
        ),
      ),
    );
  }
}
