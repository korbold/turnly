// features/reservations/presentation/widgets/reservation_card.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/reservation.dart';
import '../../../../shared/extensions/date_extensions.dart';
import '../../../../core/theme/app_theme.dart';
import 'status_badge.dart';

class ReservationCard extends StatelessWidget {
  final Reservation reservation;
  final VoidCallback? onTap;
  final bool isHighlighted;

  const ReservationCard({
    super.key,
    required this.reservation,
    this.onTap,
    this.isHighlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    final dayNum = reservation.scheduledAt.day.toString();
    final month = DateFormat('MMM', 'es').format(reservation.scheduledAt);
    final time = reservation.scheduledAt.toDisplayTime();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            boxShadow: AppColors.cardShadow,
            border: isHighlighted ? Border.all(color: AppColors.primary, width: 1.5) : null,
          ),
          child: Row(
            children: [
              // Date block
              Column(
                children: [
                  Text(dayNum, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.darkText)),
                  Text(month, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                ],
              ),
              const SizedBox(width: 16),
              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (reservation.tenantName != null)
                      Text(reservation.tenantName!, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                    if (reservation.serviceName != null)
                      Text(reservation.serviceName!, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                    const SizedBox(height: 4),
                    Text(time, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                  ],
                ),
              ),
              StatusBadge(status: reservation.status),
            ],
          ),
        ),
      ),
    );
  }
}
