import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../domain/entities/reservation.dart';
import '../../../../shared/constants/colors.dart';
import '../../../../shared/constants/status.dart';

class TimelineView extends StatelessWidget {
  final List<Reservation> reservations;
  final int startHour;
  final int endHour;
  final void Function(Reservation reservation)? onSwipeAction;

  const TimelineView({
    super.key,
    required this.reservations,
    this.startHour = 8,
    this.endHour = 20,
    this.onSwipeAction,
  });

  @override
  Widget build(BuildContext context) {
    final totalHours = endHour - startHour;
    const hourHeight = 80.0;
    final totalHeight = totalHours * hourHeight;
    final now = DateTime.now();

    return SizedBox(
      height: totalHeight + 40,
      child: Stack(
        children: [
          // Hour markers
          for (int h = startHour; h <= endHour; h++)
            Positioned(
              top: (h - startHour) * hourHeight,
              left: 0,
              right: 0,
              child: Row(
                children: [
                  SizedBox(
                    width: 48,
                    child: Text(
                      '${h.toString().padLeft(2, '0')}:00',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Container(
                      height: 0.5,
                      color: AppColors.cardBorder,
                    ),
                  ),
                ],
              ),
            ),

          // Reservation cards
          ...reservations.map((r) => _buildReservationBlock(context, r, hourHeight)),

          // "Now" red line
          if (now.hour >= startHour && now.hour < endHour)
            Positioned(
              top: ((now.hour - startHour) + now.minute / 60.0) * hourHeight,
              left: 44,
              right: 0,
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.error,
                      shape: BoxShape.circle,
                    ),
                  ),
                  Expanded(
                    child: Container(
                      height: 1.5,
                      color: AppColors.error,
                    ),
                  ),
                ],
              ),
            ),

          // Empty state
          if (reservations.isEmpty)
            Positioned.fill(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.event_available,
                      size: 48,
                      color: AppColors.textMuted.withValues(alpha: 0.5),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Sin reservas para esta fecha',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildReservationBlock(
      BuildContext context, Reservation r, double hourHeight) {
    final startMinutes =
        (r.scheduledAt.hour - startHour) * 60 + r.scheduledAt.minute;
    final endMinutes =
        (r.estimatedEnd.hour - startHour) * 60 + r.estimatedEnd.minute;
    final durationMinutes = (endMinutes - startMinutes).clamp(20, 480);

    final top = startMinutes / 60.0 * hourHeight;
    final height = durationMinutes / 60.0 * hourHeight;

    final cfg = reservationStatusConfig[r.status.apiValue] ??
        const StatusConfig(
          label: '?',
          color: AppColors.textMuted,
          bgColor: AppColors.background,
        );

    final timeFormat = DateFormat('HH:mm');

    return Positioned(
      top: top,
      left: 56,
      right: 4,
      height: height.clamp(36.0, double.infinity),
      child: GestureDetector(
        onTap: () {
          // Navigate handled by parent or GoRouter
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: cfg.bgColor,
            borderRadius: BorderRadius.circular(8),
            border: Border(
              left: BorderSide(color: cfg.color, width: 3),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      r.clientName ?? 'Cliente',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: cfg.color,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    '${timeFormat.format(r.scheduledAt)} - ${timeFormat.format(r.estimatedEnd)}',
                    style: TextStyle(
                      fontSize: 10,
                      color: cfg.color.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
              if (height > 44) ...[
                const SizedBox(height: 2),
                Text(
                  '${r.serviceName ?? 'Servicio'} ${r.clientResourcePlate != null ? '| ${r.clientResourcePlate}' : ''}',
                  style: TextStyle(
                    fontSize: 11,
                    color: cfg.color.withValues(alpha: 0.8),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
