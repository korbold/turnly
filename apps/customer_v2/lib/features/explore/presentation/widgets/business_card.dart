// lib/features/explore/presentation/widgets/business_card.dart
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/tenant_theme.dart';
import '../../../../shared/widgets/logo_gradient_background.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../domain/entities/business.dart';

class BusinessCard extends StatelessWidget {
  final Business business;
  final VoidCallback onTap;
  final int index;

  const BusinessCard({
    super.key,
    required this.business,
    required this.onTap,
    this.index = 0,
  });

  static const _typeLabels = <String, String>{
    'car_wash': 'Car Wash',
    'barbershop': 'Barberia',
    'spa': 'Spa',
    'gym': 'Gym',
    'medical': 'Medico',
  };

  @override
  Widget build(BuildContext context) {
    final tenantTheme = TenantTheme.fromBusinessType(business.businessType);
    final typeLabel =
        _typeLabels[business.businessType] ?? business.businessType ?? '';
    final hasLogo = business.logoUrl != null && business.logoUrl!.isNotEmpty;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border, width: 1),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Logo area: animated gradient pulled from the logo's own
            // colors, with the logo shown BoxFit.contain in a white card
            // so horizontal logos read fully instead of being cropped.
            LogoGradientBackground(
              logoUrl: business.logoUrl,
              fallback: [tenantTheme.primary, tenantTheme.accent],
              child: SizedBox(
                height: 120,
                width: double.infinity,
                child: Center(
                    child: hasLogo
                        ? Container(
                            constraints: const BoxConstraints(
                              maxWidth: 210,
                              minWidth: 96,
                            ),
                            height: 84,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.10),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: CachedNetworkImage(
                              imageUrl: business.logoUrl!,
                              fit: BoxFit.contain,
                              errorWidget: (_, __, ___) => _MonogramFallback(
                                name: business.name,
                                color: tenantTheme.primary,
                              ),
                            ),
                          )
                        : Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: tenantTheme.primary,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: _MonogramFallback(
                              name: business.name,
                              color: tenantTheme.primary,
                            ),
                          ),
                  ),
                ),
            ),

            // Info section
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          business.name,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (typeLabel.isNotEmpty)
                        StatusBadge(
                          label: typeLabel,
                          color: tenantTheme.primary,
                        ),
                    ],
                  ),
                  if (business.address != null &&
                      business.address!.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(
                          Icons.location_on_outlined,
                          size: 14,
                          color: AppColors.textTertiary,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            business.address!,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (business.services.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      '${business.services.length} servicio${business.services.length == 1 ? '' : 's'}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: tenantTheme.primary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(duration: Duration(milliseconds: 400 + index * 80))
        .slideY(
          begin: 0.1,
          end: 0,
          duration: Duration(milliseconds: 400 + index * 80),
          curve: Curves.easeOut,
        );
  }
}

class _MonogramFallback extends StatelessWidget {
  final String name;
  final Color color;

  const _MonogramFallback({required this.name, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color,
      alignment: Alignment.center,
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 24,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.5,
        ),
      ),
    );
  }
}
