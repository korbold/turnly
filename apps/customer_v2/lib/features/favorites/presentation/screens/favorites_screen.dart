// lib/features/favorites/presentation/screens/favorites_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../cubit/favorites_cubit.dart';
import '../cubit/favorites_state.dart';

class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Ensure favorites are loaded when screen appears
    context.read<FavoritesCubit>().loadAll();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Favoritos'),
      ),
      body: BlocBuilder<FavoritesCubit, FavoritesState>(
        builder: (context, state) {
          if (state is FavoritesInitial) {
            return const Center(child: CircularProgressIndicator());
          }

          final slugs = (state as FavoritesLoaded).slugs.toList();

          if (slugs.isEmpty) {
            return EmptyState(
              icon: Icons.favorite_border_rounded,
              title: 'Sin favoritos',
              subtitle:
                  'Los negocios que marques como favoritos aparecerán aquí.',
              actionLabel: 'Explorar negocios',
              onAction: () => context.go('/home'),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(20),
            itemCount: slugs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final slug = slugs[index];
              return _FavoriteCard(slug: slug)
                  .animate()
                  .fadeIn(
                    duration: 350.ms,
                    delay: (50 * index).ms,
                  )
                  .slideY(begin: 0.05, end: 0);
            },
          );
        },
      ),
    );
  }
}

class _FavoriteCard extends StatelessWidget {
  final String slug;

  const _FavoriteCard({required this.slug});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            // Business icon placeholder
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.accentLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.store_rounded,
                color: AppColors.accent,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),

            // Slug name
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    slug,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'Negocio guardado',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textTertiary,
                    ),
                  ),
                ],
              ),
            ),

            // View business button
            TextButton(
              onPressed: () => context.push('/business/$slug'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.accent,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
              child: const Text(
                'Ver negocio',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),

            // Remove button
            IconButton(
              onPressed: () {
                context.read<FavoritesCubit>().toggle(slug);
              },
              icon: const Icon(Icons.favorite_rounded),
              color: AppColors.error,
              iconSize: 22,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(
                minWidth: 36,
                minHeight: 36,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
