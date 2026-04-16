import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../domain/entities/reservation.dart';
import '../../../../shared/constants/colors.dart';
import '../../../../shared/constants/status.dart';
import 'package:intl/intl.dart';

class ReservationCard extends StatelessWidget {
  final Reservation reservation;
  final VoidCallback? onSwipeAction;

  const ReservationCard({
    super.key,
    required this.reservation,
    this.onSwipeAction,
  });

  StatusConfig get _statusCfg =>
      reservationStatusConfig[reservation.status.apiValue] ??
      const StatusConfig(
        label: '?',
        color: AppColors.textMuted,
        bgColor: AppColors.background,
      );

  String get _swipeLabel {
    switch (reservation.status) {
      case ReservationStatus.pending:
        return 'Confirmar';
      case ReservationStatus.confirmed:
        return 'Cancelar';
      case ReservationStatus.inProgress:
        return 'Completar';
      default:
        return '';
    }
  }

  Color get _swipeColor {
    switch (reservation.status) {
      case ReservationStatus.pending:
        return AppColors.statusConfirmed;
      case ReservationStatus.confirmed:
        return AppColors.statusCancelled;
      case ReservationStatus.inProgress:
        return AppColors.statusCompleted;
      default:
        return AppColors.textMuted;
    }
  }

  IconData get _swipeIcon {
    switch (reservation.status) {
      case ReservationStatus.pending:
        return Icons.check_circle_outline;
      case ReservationStatus.confirmed:
        return Icons.cancel_outlined;
      case ReservationStatus.inProgress:
        return Icons.done_all;
      default:
        return Icons.info_outline;
    }
  }

  bool get _canSwipe =>
      reservation.status == ReservationStatus.pending ||
      reservation.status == ReservationStatus.confirmed ||
      reservation.status == ReservationStatus.inProgress;

  @override
  Widget build(BuildContext context) {
    final timeFormat = DateFormat('HH:mm');
    final startTime = timeFormat.format(reservation.scheduledAt);
    final endTime = timeFormat.format(reservation.estimatedEnd);
    final cfg = _statusCfg;

    Widget card = GestureDetector(
      onTap: () => context.push('/reservations/${reservation.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Row(
          children: [
            // Left status bar
            Container(
              width: 4,
              height: 80,
              decoration: BoxDecoration(
                color: cfg.color,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(12),
                  bottomLeft: Radius.circular(12),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            reservation.clientName ?? 'Cliente',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        _StatusBadge(config: cfg),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      reservation.serviceName ?? 'Servicio',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.directions_car_outlined,
                            size: 14, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Text(
                          reservation.clientResourcePlate ?? '---',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Icon(Icons.access_time,
                            size: 14, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Text(
                          '$startTime - $endTime',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );

    if (!_canSwipe || onSwipeAction == null) return card;

    return Dismissible(
      key: ValueKey('reservation-${reservation.id}'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) async {
        onSwipeAction?.call();
        return false;
      },
      background: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: _swipeColor,
          borderRadius: BorderRadius.circular(12),
        ),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _swipeLabel,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 8),
            Icon(_swipeIcon, color: Colors.white),
          ],
        ),
      ),
      child: card,
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final StatusConfig config;

  const _StatusBadge({required this.config});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: config.bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        config.label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: config.color,
        ),
      ),
    );
  }
}
