// lib/features/reservations/presentation/widgets/reservation_card.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../domain/entities/reservation.dart';

class ReservationCard extends StatelessWidget {
  final Reservation reservation;
  final VoidCallback? onTap;
  final int index;

  const ReservationCard({
    super.key,
    required this.reservation,
    this.onTap,
    this.index = 0,
  });

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat("EEE d 'de' MMM", 'es');
    final timeFormat = DateFormat('HH:mm', 'es');

    return GestureDetector(
      onTap: onTap,
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top row: service name + status
            Row(
              children: [
                Expanded(
                  child: Text(
                    reservation.serviceName ?? 'Servicio',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                StatusBadge(
                  label: reservation.status.label,
                  color: reservation.status.color,
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Business name
            if (reservation.tenantName != null) ...[
              Row(
                children: [
                  const Icon(Icons.store_outlined,
                      size: 16, color: AppColors.textTertiary),
                  const SizedBox(width: 6),
                  Text(
                    reservation.tenantName!,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
            ],

            // Date and time row
            Row(
              children: [
                const Icon(Icons.calendar_today_rounded,
                    size: 16, color: AppColors.textTertiary),
                const SizedBox(width: 6),
                Text(
                  dateFormat.format(reservation.scheduledAt),
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(width: 16),
                const Icon(Icons.access_time_rounded,
                    size: 16, color: AppColors.textTertiary),
                const SizedBox(width: 6),
                Text(
                  timeFormat.format(reservation.scheduledAt),
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),

            // Resource label
            if (reservation.clientResourceLabel != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.badge_outlined,
                      size: 16, color: AppColors.textTertiary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      reservation.clientResourceLabel!,
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
          ],
        ),
      ),
    ).animate().fadeIn(
          duration: 400.ms,
          delay: (index * 80).ms,
        ).slideY(
          begin: 0.05,
          end: 0,
          duration: 400.ms,
          delay: (index * 80).ms,
        );
  }
}
