// lib/features/explore/presentation/screens/category_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/tenant_theme.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/shimmer_loader.dart';
import '../../domain/repositories/explore_repository.dart';
import '../cubit/explore_cubit.dart';
import '../cubit/explore_state.dart';
import '../widgets/business_card.dart';

class CategoryScreen extends StatelessWidget {
  final String businessType;

  const CategoryScreen({super.key, required this.businessType});

  static const _typeLabels = <String, String>{
    'car_wash': 'Car Wash',
    'barbershop': 'Barberia',
    'spa': 'Spa',
    'gym': 'Gym',
    'medical': 'Medico',
  };

  static const _typeEmojis = <String, String>{
    'car_wash': '🚗',
    'barbershop': '💈',
    'spa': '🧖',
    'gym': '💪',
    'medical': '🏥',
  };

  @override
  Widget build(BuildContext context) {
    final isAll = businessType == 'all';
    final label = isAll ? 'Todos' : (_typeLabels[businessType] ?? businessType);
    final emoji = isAll ? '🏪' : (_typeEmojis[businessType] ?? '🏪');
    final theme = isAll ? TenantTheme.fallback : TenantTheme.fromBusinessType(businessType);

    return BlocProvider(
      create: (_) => ExploreCubit(getIt<ExploreRepository>())
        ..loadBusinesses(type: isAll ? null : businessType),
      child: Builder(builder: (context) => Scaffold(
        backgroundColor: AppColors.background,
        body: NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            if (notification is ScrollEndNotification &&
                notification.metrics.extentAfter < 200) {
              context.read<ExploreCubit>().loadMore();
            }
            return false;
          },
          child: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            // Header
            SliverToBoxAdapter(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(color: theme.secondary),
                child: SafeArea(
                  bottom: false,
                  child: Stack(
                    children: [
                      Positioned(
                        right: 20,
                        bottom: 16,
                        child: Text(emoji, style: const TextStyle(fontSize: 56)),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            GestureDetector(
                              onTap: () => context.pop(),
                              child: Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: theme.primary.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(
                                  Icons.arrow_back_ios_new_rounded,
                                  color: theme.primary,
                                  size: 18,
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              label,
                              style: TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.w800,
                                color: theme.primary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Negocios disponibles',
                              style: TextStyle(
                                fontSize: 14,
                                color: theme.primary.withValues(alpha: 0.6),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            // Search bar
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Container(
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
                  child: TextField(
                    onChanged: (query) {
                      context.read<ExploreCubit>().search(query);
                    },
                    decoration: InputDecoration(
                      hintText: 'Buscar negocios...',
                      hintStyle: const TextStyle(
                        color: AppColors.textTertiary,
                        fontSize: 15,
                      ),
                      prefixIcon: const Icon(
                        Icons.search_rounded,
                        color: AppColors.textTertiary,
                        size: 22,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none,
                      ),
                      filled: true,
                      fillColor: AppColors.surface,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                  ),
                ),
              ),
            ),
            // Business list
            BlocBuilder<ExploreCubit, ExploreState>(
              builder: (context, state) {
                if (state is ExploreLoading || state is ExploreInitial) {
                  return SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverToBoxAdapter(
                      child: ShimmerLoader.list(count: 3, itemHeight: 200),
                    ),
                  );
                }

                if (state is ExploreError) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: EmptyState(
                      icon: Icons.error_outline_rounded,
                      title: 'Error al cargar',
                      subtitle: state.message,
                      actionLabel: 'Reintentar',
                      onAction: () => context
                          .read<ExploreCubit>()
                          .loadBusinesses(type: isAll ? null : businessType),
                    ),
                  );
                }

                if (state is ExploreLoaded) {
                  final businesses = state.filtered;

                  if (businesses.isEmpty) {
                    return const SliverFillRemaining(
                      hasScrollBody: false,
                      child: EmptyState(
                        icon: Icons.store_outlined,
                        title: 'Sin negocios',
                        subtitle: 'No hay negocios en esta categoria',
                      ),
                    );
                  }

                  return SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final business = businesses[index];
                          return BusinessCard(
                            business: business,
                            index: index,
                            onTap: () =>
                                context.push('/business/${business.slug}'),
                          );
                        },
                        childCount: businesses.length,
                      ),
                    ),
                  );
                }

                return const SliverToBoxAdapter(child: SizedBox.shrink());
              },
            ),
            // Loading more indicator
            BlocBuilder<ExploreCubit, ExploreState>(
              builder: (context, state) {
                if (state is ExploreLoaded && state.loadingMore) {
                  return const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    ),
                  );
                }
                return const SliverToBoxAdapter(child: SizedBox(height: 24));
              },
            ),
          ],
        ),
        ),
      )),
    );
  }
}
