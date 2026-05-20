// lib/features/explore/presentation/widgets/business_card.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/tenant_theme.dart';
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
            // Cover area — solid tint + initial monogram (no gradient)
            Container(
              height: 120,
              width: double.infinity,
              decoration: BoxDecoration(
                color: tenantTheme.primary.withValues(alpha: 0.08),
              ),
              child: Stack(
                children: [
                  // Subtle decorative dot in corner
                  Positioned(
                    right: -24,
                    top: -24,
                    child: Container(
                      width: 96,
                      height: 96,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: tenantTheme.primary.withValues(alpha: 0.06),
                      ),
                    ),
                  ),
                  // Business initial / logo placeholder
                  Center(
                    child: Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: tenantTheme.primary,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Center(
                        child: Text(
                          business.name.isNotEmpty
                              ? business.name[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
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
