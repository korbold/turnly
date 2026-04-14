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
