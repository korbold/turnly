import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';
import 'status_badge.dart';

class ReservationCard extends StatelessWidget {
  final Reservation reservation;
  final VoidCallback? onTap;
  final VoidCallback? onConfirm;
  final VoidCallback? onStart;
  final VoidCallback? onComplete;
  final VoidCallback? onCancel;

  const ReservationCard({
    super.key,
    required this.reservation,
    this.onTap,
    this.onConfirm,
    this.onStart,
    this.onComplete,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final timeStr = DateFormat('HH:mm').format(reservation.scheduledAt);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row: time + status badge
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.access_time, size: 16, color: Colors.grey),
                      const SizedBox(width: 4),
                      Text(
                        timeStr,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ],
                  ),
                  StatusBadge(status: reservation.status),
                ],
              ),
              const SizedBox(height: 8),
              // Client name
              if (reservation.clientName != null)
                Row(
                  children: [
                    const Icon(Icons.person_outline, size: 15, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(reservation.clientName!, style: const TextStyle(fontSize: 14)),
                  ],
                ),
              const SizedBox(height: 4),
              // Vehicle plate
              if (reservation.vehiclePlate != null)
                Row(
                  children: [
                    const Icon(Icons.directions_car_outlined, size: 15, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(
                      reservation.vehiclePlate!,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                    ),
                    if (reservation.vehicleBrand != null) ...[
                      const SizedBox(width: 6),
                      Text(
                        reservation.vehicleBrand!,
                        style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                      ),
                    ],
                  ],
                ),
              const SizedBox(height: 4),
              // Service name
              if (reservation.serviceName != null)
                Row(
                  children: [
                    const Icon(Icons.event_available, size: 15, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(reservation.serviceName!, style: const TextStyle(fontSize: 14)),
                  ],
                ),
              // Action buttons
              _buildActionButtons(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context) {
    final buttons = _getButtons(context);
    if (buttons.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(
        children: buttons
            .map((b) => Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: b,
                  ),
                ))
            .toList(),
      ),
    );
  }

  List<Widget> _getButtons(BuildContext context) {
    switch (reservation.status) {
      case ReservationStatus.pending:
        return [
          FilledButton(
            onPressed: onConfirm,
            style: FilledButton.styleFrom(backgroundColor: Colors.green),
            child: const Text('Confirmar', style: TextStyle(fontSize: 13)),
          ),
          OutlinedButton(
            onPressed: onCancel,
            style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Cancelar', style: TextStyle(fontSize: 13)),
          ),
        ];
      case ReservationStatus.confirmed:
        return [
          FilledButton(
            onPressed: onStart,
            style: FilledButton.styleFrom(backgroundColor: Colors.blue),
            child: const Text('Iniciar', style: TextStyle(fontSize: 13)),
          ),
          OutlinedButton(
            onPressed: onCancel,
            style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Cancelar', style: TextStyle(fontSize: 13)),
          ),
        ];
      case ReservationStatus.inProgress:
        return [
          FilledButton(
            onPressed: onComplete,
            style: FilledButton.styleFrom(backgroundColor: Colors.green),
            child: const Text('Completar', style: TextStyle(fontSize: 13)),
          ),
        ];
      case ReservationStatus.completed:
      case ReservationStatus.cancelled:
      case ReservationStatus.noShow:
        return [];
    }
  }
}
