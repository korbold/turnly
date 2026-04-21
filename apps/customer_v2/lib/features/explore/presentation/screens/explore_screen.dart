// lib/features/explore/presentation/screens/explore_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/tenant_theme.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/avatar_circle.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../auth/presentation/cubit/auth_cubit.dart';
import '../../../auth/presentation/cubit/auth_state.dart';
import '../../../reservations/domain/repositories/reservation_repository.dart';
import '../../../reservations/presentation/cubit/reservations_cubit.dart';
import '../../../reservations/presentation/cubit/reservations_state.dart';
import '../../domain/repositories/explore_repository.dart';
import '../cubit/explore_cubit.dart';
import '../widgets/next_reservation_card.dart';

class ExploreScreen extends StatelessWidget {
  const ExploreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (_) =>
              ExploreCubit(getIt<ExploreRepository>())..loadBusinesses(),
        ),
        BlocProvider(
          create: (_) =>
              ReservationsCubit(getIt<ReservationRepository>())
                ..loadReservations(),
        ),
      ],
      child: const _ExploreView(),
    );
  }
}

class _ExploreView extends StatelessWidget {
  const _ExploreView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.accent,
          onRefresh: () async {
            context.read<ReservationsCubit>().loadReservations();
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              // Header
              SliverToBoxAdapter(child: _buildHeader(context)),
              // Next reservation
              const SliverToBoxAdapter(child: _NextReservationSection()),
              // Categories title
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 14),
                  child: const SectionHeader(title: 'Categorias'),
                ),
              ),
              // Category grid
              const SliverToBoxAdapter(child: _CategoryGrid()),
              // Bottom spacing
              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, authState) {
        String greeting = 'Hola!';
        String userName = '';

        if (authState is AuthAuthenticated) {
          final firstName = authState.user.name.split(' ').first;
          greeting = 'Hola, $firstName';
          userName = authState.user.name;
        }

        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      greeting,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Encuentra tu proximo turno',
                      style: TextStyle(
                        fontSize: 15,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              AvatarCircle(
                name: userName.isNotEmpty ? userName : 'U',
                size: 44,
              ),
            ],
          ),
        );
      },
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .slideY(begin: -0.05, end: 0, duration: 400.ms);
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: GestureDetector(
        onTap: () => context.push('/category/all'),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 16,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              const Icon(Icons.search_rounded, color: AppColors.textTertiary, size: 22),
              const SizedBox(width: 12),
              Text(
                'Buscar negocios...',
                style: TextStyle(
                  color: AppColors.textTertiary,
                  fontSize: 15,
                ),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 500.ms, delay: 100.ms);
  }
}

class _NextReservationSection extends StatelessWidget {
  const _NextReservationSection();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReservationsCubit, ReservationsState>(
      builder: (context, state) {
        if (state is! ReservationsLoaded) return const SizedBox.shrink();

        final upcoming = state.reservations
            .where((r) => r.status.isUpcoming)
            .toList()
          ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));

        if (upcoming.isEmpty) return const SizedBox.shrink();

        final next = upcoming.first;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: const SectionHeader(title: 'Proxima reserva'),
            ),
            const SizedBox(height: 12),
            NextReservationCard(
              reservation: next,
              onTap: () {
                context.push('/reservations/${next.id}');
              },
            ),
          ],
        );
      },
    );
  }
}

class _CategoryGrid extends StatelessWidget {
  const _CategoryGrid();

  static const _categories = [
    _CategoryItem(
      type: 'car_wash',
      label: 'Car Wash',
      emoji: '🚗',
      subtitle: 'Lavado de vehiculos',
    ),
    _CategoryItem(
      type: 'barbershop',
      label: 'Barberia',
      emoji: '💈',
      subtitle: 'Cortes y estilos',
    ),
    _CategoryItem(
      type: 'spa',
      label: 'Spa',
      emoji: '🧖',
      subtitle: 'Bienestar y relax',
    ),
    _CategoryItem(
      type: 'gym',
      label: 'Gym',
      emoji: '💪',
      subtitle: 'Entrenamiento',
    ),
    _CategoryItem(
      type: 'medical',
      label: 'Medico',
      emoji: '🏥',
      subtitle: 'Consultas medicas',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 14,
          crossAxisSpacing: 14,
          childAspectRatio: 1.4,
        ),
        itemCount: _categories.length,
        itemBuilder: (context, index) {
          final cat = _categories[index];
          final theme = TenantTheme.fromBusinessType(cat.type);

          return GestureDetector(
            onTap: () => context.push('/category/${cat.type}'),
            child: Container(
              decoration: BoxDecoration(
                color: theme.secondary,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: theme.primary.withValues(alpha: 0.1),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  // Decorative blob
                  Positioned(
                    right: -10,
                    top: -10,
                    child: Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: theme.primary.withValues(alpha: 0.08),
                      ),
                    ),
                  ),
                  // Emoji
                  Positioned(
                    right: 12,
                    bottom: 12,
                    child: Text(
                      cat.emoji,
                      style: const TextStyle(fontSize: 36),
                    ),
                  ),
                  // Text
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          cat.label,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: theme.primary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          cat.subtitle,
                          style: TextStyle(
                            fontSize: 12,
                            color: theme.primary.withValues(alpha: 0.6),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          )
              .animate()
              .fadeIn(duration: Duration(milliseconds: 400 + index * 80))
              .scale(
                begin: const Offset(0.9, 0.9),
                end: const Offset(1, 1),
                duration: Duration(milliseconds: 400 + index * 80),
                curve: Curves.easeOut,
              );
        },
      ),
    );
  }
}

class _CategoryItem {
  final String type;
  final String label;
  final String emoji;
  final String subtitle;

  const _CategoryItem({
    required this.type,
    required this.label,
    required this.emoji,
    required this.subtitle,
  });
}
