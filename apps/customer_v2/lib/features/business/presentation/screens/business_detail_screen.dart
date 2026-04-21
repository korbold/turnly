// lib/features/business/presentation/screens/business_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/tenant_theme.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/shimmer_loader.dart';
import '../../../explore/domain/entities/business.dart';
import '../../../explore/domain/repositories/explore_repository.dart';
import '../cubit/business_detail_cubit.dart';
import '../cubit/business_detail_state.dart';
import '../widgets/hero_header.dart';
import '../widgets/hours_section.dart';
import '../widgets/service_card.dart';

class BusinessDetailScreen extends StatelessWidget {
  final String slug;

  const BusinessDetailScreen({super.key, required this.slug});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) =>
          BusinessDetailCubit(getIt<ExploreRepository>())..loadBusiness(slug),
      child: _BusinessDetailView(slug: slug),
    );
  }
}

class _BusinessDetailView extends StatelessWidget {
  final String slug;

  const _BusinessDetailView({required this.slug});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<BusinessDetailCubit, BusinessDetailState>(
      builder: (context, state) {
        if (state is BusinessDetailLoading || state is BusinessDetailInitial) {
          return _buildLoadingState();
        }

        if (state is BusinessDetailError) {
          return Scaffold(
            backgroundColor: AppColors.background,
            body: EmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Error al cargar el negocio',
              subtitle: state.message,
              actionLabel: 'Reintentar',
              onAction: () {
                context.read<BusinessDetailCubit>().loadBusiness(slug);
              },
            ),
          );
        }

        if (state is BusinessDetailLoaded) {
          return _BusinessContent(business: state.business);
        }

        return const SizedBox.shrink();
      },
    );
  }

  Widget _buildLoadingState() {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ShimmerLoader(height: 220, borderRadius: 0),
              const SizedBox(height: 20),
              const ShimmerLoader(height: 28, width: 200),
              const SizedBox(height: 12),
              const ShimmerLoader(height: 16, width: 120),
              const SizedBox(height: 24),
              const ShimmerLoader(height: 44),
              const SizedBox(height: 24),
              ShimmerLoader.list(count: 3, itemHeight: 90),
            ],
          ),
        ),
      ),
    );
  }
}

class _BusinessContent extends StatelessWidget {
  final Business business;

  const _BusinessContent({required this.business});

  @override
  Widget build(BuildContext context) {
    final tenantTheme = TenantTheme.fromBusinessType(business.businessType);

    return Theme(
      data: Theme.of(context).copyWith(
        colorScheme: Theme.of(context).colorScheme.copyWith(
              primary: tenantTheme.primary,
              secondary: tenantTheme.accent,
            ),
      ),
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: DefaultTabController(
          length: 3,
          child: NestedScrollView(
            headerSliverBuilder: (context, innerBoxIsScrolled) {
              return [
                SliverToBoxAdapter(
                  child: HeroHeader(
                    business: business,
                    tenantTheme: tenantTheme,
                  ),
                ),
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _TabBarDelegate(
                    tenantTheme: tenantTheme,
                    tabBar: TabBar(
                      labelColor: tenantTheme.primary,
                      unselectedLabelColor: AppColors.textSecondary,
                      indicatorColor: tenantTheme.primary,
                      indicatorWeight: 3,
                      labelStyle: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                      unselectedLabelStyle: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                      tabs: const [
                        Tab(text: 'Servicios'),
                        Tab(text: 'Info'),
                        Tab(text: 'Horarios'),
                      ],
                    ),
                  ),
                ),
              ];
            },
            body: TabBarView(
              children: [
                // Servicios tab
                _ServicesTab(
                  business: business,
                  tenantTheme: tenantTheme,
                ),
                // Info tab
                _InfoTab(
                  business: business,
                  tenantTheme: tenantTheme,
                ),
                // Horarios tab
                HoursSection(
                  hours: business.hours,
                  tenantTheme: tenantTheme,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Services Tab
class _ServicesTab extends StatelessWidget {
  final Business business;
  final TenantTheme tenantTheme;

  const _ServicesTab({
    required this.business,
    required this.tenantTheme,
  });

  @override
  Widget build(BuildContext context) {
    if (business.services.isEmpty) {
      return const EmptyState(
        icon: Icons.miscellaneous_services_outlined,
        title: 'Sin servicios',
        subtitle: 'Este negocio aun no tiene servicios registrados',
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: business.services.length,
      itemBuilder: (context, index) {
        final service = business.services[index];
        return ServiceCard(
          service: service,
          tenantTheme: tenantTheme,
          index: index,
          onReserve: () async {
            await SecureStorage.saveTenantSlug(business.slug);
            if (context.mounted) {
              context.push('/reservations/create', extra: {
                'tenantSlug': business.slug,
                'serviceId': service.id,
                'services': business.services,
                'customFields': business.customFields,
                'businessType': business.businessType,
              });
            }
          },
        );
      },
    );
  }
}

// Info Tab
class _InfoTab extends StatelessWidget {
  final Business business;
  final TenantTheme tenantTheme;

  const _InfoTab({
    required this.business,
    required this.tenantTheme,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (business.address != null && business.address!.isNotEmpty)
          _InfoRow(
            icon: Icons.location_on_outlined,
            label: 'Direccion',
            value: business.address!,
            color: tenantTheme.primary,
          ).animate().fadeIn(duration: 400.ms),

        if (business.phone != null && business.phone!.isNotEmpty)
          _InfoRow(
            icon: Icons.phone_outlined,
            label: 'Telefono',
            value: business.phone!,
            color: tenantTheme.primary,
          ).animate().fadeIn(duration: 400.ms, delay: 100.ms),

        if (business.mapsUrl != null && business.mapsUrl!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => launchUrl(
                  Uri.parse(business.mapsUrl!),
                  mode: LaunchMode.externalApplication,
                ),
                icon: Icon(Icons.map_outlined, color: tenantTheme.primary),
                label: Text(
                  'Abrir en mapa',
                  style: TextStyle(color: tenantTheme.primary, fontWeight: FontWeight.w600),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: tenantTheme.primary.withValues(alpha: 0.3)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ).animate().fadeIn(duration: 400.ms, delay: 150.ms),

        if (business.description != null &&
            business.description!.isNotEmpty) ...[
          const SizedBox(height: 20),
          const Text(
            'Acerca de',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
          const SizedBox(height: 10),
          Text(
            business.description!,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.6,
            ),
          ).animate().fadeIn(duration: 400.ms, delay: 250.ms),
        ],

        // Additional info
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: tenantTheme.secondary.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              _MiniInfoBlock(
                icon: Icons.timer_outlined,
                label: 'Duracion turno',
                value: '${business.slotDuration} min',
                color: tenantTheme.primary,
              ),
              Container(
                width: 1,
                height: 40,
                color: AppColors.border,
              ),
              _MiniInfoBlock(
                icon: Icons.cancel_outlined,
                label: 'Cancelacion',
                value: '${business.cancellationHours}h antes',
                color: tenantTheme.primary,
              ),
            ],
          ),
        ).animate().fadeIn(duration: 400.ms, delay: 300.ms),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textTertiary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniInfoBlock extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _MiniInfoBlock({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }
}

// TabBar delegate for pinned tab bar
class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  final TenantTheme tenantTheme;

  const _TabBarDelegate({
    required this.tabBar,
    required this.tenantTheme,
  });

  @override
  double get minExtent => tabBar.preferredSize.height;

  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(
      color: AppColors.surface,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_TabBarDelegate oldDelegate) => false;
}
