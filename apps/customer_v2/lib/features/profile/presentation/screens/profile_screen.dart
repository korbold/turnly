// lib/features/profile/presentation/screens/profile_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/avatar_circle.dart';
import '../../../auth/presentation/cubit/auth_cubit.dart';
import '../../../auth/presentation/cubit/auth_state.dart';
import '../../../favorites/presentation/cubit/favorites_cubit.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: BlocBuilder<AuthCubit, AuthState>(
        builder: (context, state) {
          String name = 'Usuario';
          String email = '';

          if (state is AuthAuthenticated) {
            name = state.user.name;
            email = state.user.email;
          }

          return CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              // Dark header with avatar
              SliverToBoxAdapter(
                child: Container(
                  width: double.infinity,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFF1E293B),
                        Color(0xFF334155),
                      ],
                    ),
                    borderRadius: BorderRadius.only(
                      bottomLeft: Radius.circular(32),
                      bottomRight: Radius.circular(32),
                    ),
                  ),
                  child: SafeArea(
                    bottom: false,
                    child: Stack(
                      children: [
                        // Decorative circles
                        Positioned(
                          right: -30,
                          top: -20,
                          child: Container(
                            width: 120,
                            height: 120,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white.withValues(alpha: 0.05),
                            ),
                          ),
                        ),
                        Positioned(
                          left: -20,
                          bottom: 10,
                          child: Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white.withValues(alpha: 0.04),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                          child: Column(
                            children: [
                              // Title row
                              const Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  'Perfil',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white70,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 24),
                              // Avatar
                              Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.2),
                                    width: 2,
                                  ),
                                ),
                                child: AvatarCircle(
                                  name: name,
                                  size: 72,
                                ),
                              ).animate().scale(
                                    begin: const Offset(0.8, 0.8),
                                    end: const Offset(1, 1),
                                    duration: 400.ms,
                                    curve: Curves.easeOut,
                                  ),
                              const SizedBox(height: 14),
                              Text(
                                name,
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                email,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.white.withValues(alpha: 0.6),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ).animate().fadeIn(duration: 400.ms),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 28)),

              // Section title
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: const Text(
                    'Mi Cuenta',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ).animate().fadeIn(duration: 400.ms, delay: 100.ms),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 12)),

              // Menu items
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        _ProfileMenuItem(
                          icon: Icons.badge_outlined,
                          label: 'Mis Registros',
                          onTap: () => context.push('/resources'),
                        ),
                        const Divider(height: 1, indent: 60, endIndent: 16),
                        _ProfileMenuItem(
                          icon: Icons.notifications_outlined,
                          label: 'Notificaciones',
                          onTap: () => context.push('/notifications'),
                        ),
                        const Divider(height: 1, indent: 60, endIndent: 16),
                        _ProfileMenuItem(
                          icon: Icons.favorite_outline_rounded,
                          label: 'Favoritos',
                          onTap: () => context.push('/favorites'),
                        ),
                        const Divider(height: 1, indent: 60, endIndent: 16),
                        _ProfileMenuItem(
                          icon: Icons.help_outline_rounded,
                          label: 'Ayuda',
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Proximamente')),
                            );
                          },
                        ),
                      ],
                    ),
                  ).animate().fadeIn(duration: 400.ms, delay: 150.ms).slideY(
                        begin: 0.03,
                        end: 0,
                        duration: 400.ms,
                        delay: 150.ms,
                      ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 16)),

              // Logout
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: _ProfileMenuItem(
                      icon: Icons.logout_rounded,
                      label: 'Cerrar sesion',
                      iconColor: AppColors.error,
                      textColor: AppColors.error,
                      showChevron: false,
                      onTap: () async {
                        final confirmed = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                            ),
                            title: const Text(
                              'Cerrar sesion',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            content: const Text(
                              'Estas seguro de que deseas cerrar sesion?',
                              style: TextStyle(
                                fontSize: 14,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx, false),
                                child: const Text('Cancelar'),
                              ),
                              TextButton(
                                onPressed: () => Navigator.pop(ctx, true),
                                style: TextButton.styleFrom(
                                    foregroundColor: AppColors.error),
                                child: const Text('Cerrar sesion'),
                              ),
                            ],
                          ),
                        );

                        if (confirmed == true && context.mounted) {
                          context.read<FavoritesCubit>().clear();
                          await context.read<AuthCubit>().logout();
                          if (context.mounted) {
                            context.go('/login');
                          }
                        }
                      },
                    ),
                  ).animate().fadeIn(duration: 400.ms, delay: 250.ms),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 32)),

              // Version
              SliverToBoxAdapter(
                child: Center(
                  child: Text(
                    'Turnly v1.0.0',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textTertiary,
                    ),
                  ).animate().fadeIn(duration: 400.ms, delay: 300.ms),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          );
        },
      ),
    );
  }
}

class _ProfileMenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? iconColor;
  final Color? textColor;
  final bool showChevron;

  const _ProfileMenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.iconColor,
    this.textColor,
    this.showChevron = true,
  });

  @override
  Widget build(BuildContext context) {
    final iColor = iconColor ?? AppColors.textSecondary;
    final tColor = textColor ?? AppColors.textPrimary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iColor.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iColor, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: tColor,
                ),
              ),
            ),
            if (showChevron)
              Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textTertiary.withValues(alpha: 0.5),
                size: 22,
              ),
          ],
        ),
      ),
    );
  }
}
