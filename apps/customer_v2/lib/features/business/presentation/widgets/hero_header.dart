// lib/features/business/presentation/widgets/hero_header.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/tenant_theme.dart';
import '../../../explore/domain/entities/business.dart';

class HeroHeader extends StatelessWidget {
  final Business business;
  final TenantTheme tenantTheme;
  final VoidCallback? onBack;

  const HeroHeader({
    super.key,
    required this.business,
    required this.tenantTheme,
    this.onBack,
  });

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
    final typeLabel =
        _typeLabels[business.businessType] ?? business.businessType ?? '';
    final typeEmoji = _typeEmojis[business.businessType] ?? '🏪';

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: tenantTheme.secondary,
      ),
      child: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            // Decorative blobs
            Positioned(
              right: -30,
              top: 20,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: tenantTheme.primary.withValues(alpha: 0.08),
                ),
              ),
            ),
            Positioned(
              right: 40,
              top: -20,
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: tenantTheme.primary.withValues(alpha: 0.06),
                ),
              ),
            ),
            Positioned(
              left: -20,
              bottom: 10,
              child: Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: tenantTheme.primary.withValues(alpha: 0.05),
                ),
              ),
            ),

            // Big emoji decoration
            Positioned(
              right: 20,
              bottom: 30,
              child: Text(
                typeEmoji,
                style: const TextStyle(fontSize: 64),
              ).animate().fadeIn(duration: 600.ms, delay: 200.ms).scale(
                    begin: const Offset(0.5, 0.5),
                    end: const Offset(1, 1),
                    duration: 600.ms,
                    delay: 200.ms,
                    curve: Curves.elasticOut,
                  ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Back button
                  Row(
                    children: [
                      GestureDetector(
                        onTap: onBack ?? () => Navigator.of(context).pop(),
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: tenantTheme.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            Icons.arrow_back_ios_new_rounded,
                            color: tenantTheme.primary,
                            size: 18,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Business name
                  SizedBox(
                    width: MediaQuery.of(context).size.width * 0.6,
                    child: Text(
                      business.name,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        height: 1.2,
                      ),
                    ).animate()
                        .fadeIn(duration: 400.ms, delay: 100.ms)
                        .slideX(begin: -0.03, end: 0),
                  ),
                  const SizedBox(height: 10),

                  // Type badge
                  if (typeLabel.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: tenantTheme.primary,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        typeLabel,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ).animate().fadeIn(duration: 400.ms, delay: 200.ms),

                  const SizedBox(height: 16),

                  // Stats row
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _StatChip(
                        icon: Icons.miscellaneous_services_rounded,
                        value: '${business.services.length}',
                        label: 'Servicios',
                        color: tenantTheme.primary,
                      ),
                      _StatChip(
                        icon: Icons.timer_outlined,
                        value: '${business.slotDuration}',
                        label: 'min',
                        color: tenantTheme.primary,
                      ),
                      if (business.address != null && business.address!.isNotEmpty)
                        _StatChip(
                          icon: Icons.location_on_outlined,
                          value: '',
                          label: business.address!.length > 15
                              ? '${business.address!.substring(0, 15)}...'
                              : business.address!,
                          color: tenantTheme.primary,
                        ),
                    ],
                  ).animate().fadeIn(duration: 400.ms, delay: 300.ms),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;

  const _StatChip({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          if (value.isNotEmpty) ...[
            Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
