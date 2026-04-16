import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/constants/colors.dart';

class _SettingsCategory {
  final String key;
  final String title;
  final IconData icon;

  const _SettingsCategory({
    required this.key,
    required this.title,
    required this.icon,
  });
}

const _categories = [
  _SettingsCategory(key: 'general', title: 'General', icon: Icons.store),
  _SettingsCategory(
      key: 'schedule', title: 'Horario', icon: Icons.schedule),
  _SettingsCategory(
      key: 'gallery', title: 'Galeria', icon: Icons.photo_library),
  _SettingsCategory(
      key: 'custom-fields',
      title: 'Campos Personalizados',
      icon: Icons.text_fields),
  _SettingsCategory(
      key: 'permissions', title: 'Permisos', icon: Icons.security),
  _SettingsCategory(key: 'brand', title: 'Marca', icon: Icons.palette),
];

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  Text(
                    'Configuracion',
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontSize: 22),
                  ),
                  const Spacer(),
                ],
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                itemCount: _categories.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final cat = _categories[index];
                  return Card(
                    margin: EdgeInsets.zero,
                    child: ListTile(
                      leading: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.primaryMuted,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child:
                            Icon(cat.icon, color: AppColors.primary, size: 20),
                      ),
                      title: Text(
                        cat.title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      trailing: const Icon(
                        Icons.chevron_right,
                        color: AppColors.textMuted,
                      ),
                      onTap: () => context.push('/settings/${cat.key}'),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
