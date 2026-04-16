import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../domain/entities/reservation.dart';
import '../../../../shared/constants/colors.dart';

class UpcomingReservations extends StatelessWidget {
  final List<Reservation> reservations;

  const UpcomingReservations({super.key, required this.reservations});

  @override
  Widget build(BuildContext context) {
    final upcoming = reservations.take(5).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Proximas reservas',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const Spacer(),
            TextButton(
              onPressed: () => context.go('/reservations'),
              child: const Text('Ver todas'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (upcoming.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 40),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Column(
              children: [
                const Icon(Icons.event_available,
                    size: 40, color: AppColors.textMuted),
                const SizedBox(height: 8),
                Text(
                  'Sin reservas proximas',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppColors.textMuted,
                      ),
                ),
              ],
            ),
          )
        else
          ...upcoming.map((r) => _ReservationRow(reservation: r)),
      ],
    );
  }
}

class _ReservationRow extends StatelessWidget {
  final Reservation reservation;

  const _ReservationRow({required this.reservation});

  @override
  Widget build(BuildContext context) {
    final timeFormat = DateFormat('HH:mm');
    final now = DateTime.now();
    final diff = reservation.scheduledAt.difference(now);
    final isUpcoming = diff.inMinutes > 0 && diff.inMinutes <= 30;

    return InkWell(
      onTap: () => context.go('/reservations/${reservation.id}'),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Row(
          children: [
            // Time
            SizedBox(
              width: 52,
              child: Text(
                timeFormat.format(reservation.scheduledAt),
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: AppColors.primary,
                      fontSize: 15,
                    ),
              ),
            ),
            const SizedBox(width: 12),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    reservation.clientName ??
                        reservation.clientResourcePlate ??
                        'Cliente',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontSize: 14,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    reservation.serviceName ?? 'Servicio',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),

            // Urgency badge
            if (isUpcoming)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.warningMuted,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'en ${diff.inMinutes} min',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.warning,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
