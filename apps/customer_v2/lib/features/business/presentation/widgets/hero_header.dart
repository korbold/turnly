// lib/features/business/presentation/widgets/hero_header.dart
import 'package:cached_network_image/cached_network_image.dart';
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
    final hasLogo = business.logoUrl != null && business.logoUrl!.isNotEmpty;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            tenantTheme.primary.withValues(alpha: 0.06),
            tenantTheme.secondary,
          ],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            // Subtle decorative blobs for depth
            Positioned(
              right: -30,
              top: 10,
              child: _blob(120, tenantTheme.primary.withValues(alpha: 0.06)),
            ),
            Positioned(
              left: -24,
              bottom: 0,
              child: _blob(70, tenantTheme.primary.withValues(alpha: 0.05)),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Back button (left-aligned)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: GestureDetector(
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
                  ),
                  const SizedBox(height: 8),

                  // Centered logo card (logo as cover)
                  Center(
                    child: Container(
                      width: 96,
                      height: 96,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: hasLogo
                          ? CachedNetworkImage(
                              imageUrl: business.logoUrl!,
                              fit: BoxFit.contain,
                              errorWidget: (_, __, ___) => Center(
                                child: Text(typeEmoji,
                                    style: const TextStyle(fontSize: 44)),
                              ),
                            )
                          : Center(
                              child: Text(typeEmoji,
                                  style: const TextStyle(fontSize: 44)),
                            ),
                    ).animate().fadeIn(duration: 600.ms, delay: 150.ms).scale(
                          begin: const Offset(0.6, 0.6),
                          end: const Offset(1, 1),
                          duration: 600.ms,
                          delay: 150.ms,
                          curve: Curves.elasticOut,
                        ),
                  ),
                  const SizedBox(height: 14),

                  // Business name (centered)
                  Text(
                    business.name,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ).animate().fadeIn(duration: 400.ms, delay: 100.ms),
                  const SizedBox(height: 10),

                  // Type badge (centered)
                  if (typeLabel.isNotEmpty)
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
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
                    ),

                  const SizedBox(height: 16),

                  // Stats row (centered)
                  Wrap(
                    alignment: WrapAlignment.center,
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
                      if (business.address != null &&
                          business.address!.isNotEmpty)
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

  Widget _blob(double size, Color color) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      );
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
