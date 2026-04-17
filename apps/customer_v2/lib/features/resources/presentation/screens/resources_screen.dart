// lib/features/resources/presentation/screens/resources_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/shimmer_loader.dart';
import '../../domain/repositories/resource_repository.dart';
import '../cubit/resources_cubit.dart';
import '../cubit/resources_state.dart';

class ResourcesScreen extends StatelessWidget {
  const ResourcesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) =>
          ResourcesCubit(getIt<ResourceRepository>())..loadResources(),
      child: const _ResourcesView(),
    );
  }
}

class _ResourcesView extends StatelessWidget {
  const _ResourcesView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Mis Registros',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: true,
      ),
      body: BlocBuilder<ResourcesCubit, ResourcesState>(
        builder: (context, state) {
          if (state is ResourcesLoading || state is ResourcesInitial) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: ShimmerLoader.list(count: 4, itemHeight: 80),
            );
          }

          if (state is ResourcesError) {
            return EmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Error al cargar registros',
              subtitle: state.message,
              actionLabel: 'Reintentar',
              onAction: () => context.read<ResourcesCubit>().loadResources(),
            );
          }

          if (state is ResourcesLoaded) {
            if (state.resources.isEmpty) {
              return const EmptyState(
                icon: Icons.badge_outlined,
                title: 'Sin registros',
                subtitle: 'Agrega tu primer registro para comenzar',
              );
            }

            return RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                context.read<ResourcesCubit>().loadResources();
              },
              child: ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                padding: const EdgeInsets.all(20),
                itemCount: state.resources.length,
                itemBuilder: (context, index) {
                  final resource = state.resources[index];
                  return GestureDetector(
                    onTap: () {
                      context.push(
                        '/resources/${resource.id}/history',
                        extra: resource.label,
                      );
                    },
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.06),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              color: AppColors.accentLight,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.badge_outlined,
                              color: AppColors.accent,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  resource.label,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                const Text(
                                  'Ver historial de servicios',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textTertiary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: AppColors.textTertiary,
                          ),
                        ],
                      ),
                    ),
                  )
                      .animate()
                      .fadeIn(
                        duration: 400.ms,
                        delay: (index * 80).ms,
                      )
                      .slideY(
                        begin: 0.05,
                        end: 0,
                        duration: 400.ms,
                        delay: (index * 80).ms,
                      );
                },
              ),
            );
          }

          return const SizedBox.shrink();
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await context.push('/resources/add');
          // Reload on return
          if (context.mounted) {
            context.read<ResourcesCubit>().loadResources();
          }
        },
        backgroundColor: AppColors.accent,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.add_rounded),
      ).animate().fadeIn(duration: 500.ms, delay: 300.ms).slideY(
            begin: 0.3,
            end: 0,
            duration: 500.ms,
            delay: 300.ms,
            curve: Curves.easeOut,
          ),
    );
  }
}
