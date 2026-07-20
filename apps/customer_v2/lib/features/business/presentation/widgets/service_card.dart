// lib/features/business/presentation/widgets/service_card.dart
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/tenant_theme.dart';
import '../../../explore/domain/entities/service.dart';

class ServiceCard extends StatelessWidget {
  final Service service;
  final TenantTheme tenantTheme;
  final VoidCallback onReserve;
  final int index;

  const ServiceCard({
    super.key,
    required this.service,
    required this.tenantTheme,
    required this.onReserve,
    this.index = 0,
  });

  @override
  Widget build(BuildContext context) {
    final priceFormat = NumberFormat.currency(
      locale: 'es',
      symbol: '\$',
      decimalDigits: 2,
    );
    final hasImage =
        service.imageUrl != null && service.imageUrl!.isNotEmpty;

    final priceText = service.hasVariants
        ? 'Desde ${priceFormat.format(service.displayPrice)}'
        : priceFormat.format(service.price);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Full-width banner image on top (only when the service has one)
          if (hasImage)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Container(
                color: tenantTheme.secondary,
                child: CachedNetworkImage(
                  imageUrl: service.imageUrl!,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Center(
                    child: Icon(
                      Icons.miscellaneous_services_rounded,
                      color: tenantTheme.primary,
                      size: 28,
                    ),
                  ),
                ),
              ),
            ),

          // Body: name, description, price + duration, reserve button
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  service.name,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (service.description != null &&
                    service.description!.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    service.description!,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 10),
                Row(
                  children: [
                    Text(
                      priceText,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: tenantTheme.primary,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Icon(
                      Icons.schedule_rounded,
                      size: 14,
                      color: AppColors.textTertiary,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      '${service.durationMinutes} min',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textTertiary,
                      ),
                    ),
                    const Spacer(),
                    SizedBox(
                      height: 36,
                      child: ElevatedButton(
                        onPressed: onReserve,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: tenantTheme.accent,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding:
                              const EdgeInsets.symmetric(horizontal: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                        child: const Text(
                          'Reservar',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: Duration(milliseconds: 350 + index * 60))
        .slideX(
          begin: 0.05,
          end: 0,
          duration: Duration(milliseconds: 350 + index * 60),
          curve: Curves.easeOut,
        );
  }
}
