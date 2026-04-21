// lib/features/reservations/presentation/widgets/reservation_card.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_colors.dart';
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
    final dateFormat = DateFormat('d', 'es');
    final monthFormat = DateFormat('MMM', 'es');
    final timeFormat = DateFormat('HH:mm', 'es');
    final statusColor = reservation.status.color;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 12,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              // Date column with status color
              Container(
                width: 64,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(18),
                    bottomLeft: Radius.circular(18),
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      dateFormat.format(reservation.scheduledAt),
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: statusColor,
                        height: 1,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      monthFormat.format(reservation.scheduledAt).toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: statusColor,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: statusColor,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        reservation.status.label,
                        style: const TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Business name (full)
                      Text(
                        reservation.tenantName ?? 'Negocio',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),

                      const SizedBox(height: 6),

                      // Service + time row
                      Row(
                        children: [
                          Icon(Icons.circle, size: 8, color: statusColor),
                          const SizedBox(width: 6),
                          Text(
                            reservation.serviceName ?? 'Servicio',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const Spacer(),
                          Icon(Icons.access_time_rounded, size: 14, color: statusColor),
                          const SizedBox(width: 4),
                          Text(
                            timeFormat.format(reservation.scheduledAt),
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: statusColor,
                            ),
                          ),
                        ],
                      ),

                      // Resource label
                      if (reservation.clientResourceLabel != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          reservation.clientResourceLabel!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textTertiary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // Chevron
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textTertiary.withValues(alpha: 0.5),
                  size: 22,
                ),
              ),
            ],
          ),
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
