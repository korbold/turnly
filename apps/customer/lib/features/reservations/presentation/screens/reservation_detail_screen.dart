import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../infrastructure/reservation_repository_impl.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';
import '../widgets/status_badge.dart';
import '../../../../shared/extensions/date_extensions.dart';

class ReservationDetailScreen extends StatefulWidget {
  final String reservationId;

  const ReservationDetailScreen({super.key, required this.reservationId});

  @override
  State<ReservationDetailScreen> createState() =>
      _ReservationDetailScreenState();
}

class _ReservationDetailScreenState extends State<ReservationDetailScreen> {
  final _repo = ReservationRepositoryImpl();
  late Future<Reservation> _future;
  bool _cancelling = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = _repo
        .getById(widget.reservationId)
        .then((result) => result.fold(
              (f) => throw f.message,
              (r) => r,
            ));
  }

  bool _canCancel(Reservation reservation) {
    if (reservation.status != ReservationStatus.pending &&
        reservation.status != ReservationStatus.confirmed) {
      return false;
    }
    if (reservation.cancellationHours <= 0) return true;
    return reservation.scheduledAt.difference(DateTime.now()).inMinutes >=
        (reservation.cancellationHours * 60);
  }

  Future<void> _cancel(Reservation reservation) async {
    final reason = await _showCancelDialog();
    if (reason == null) return;

    setState(() => _cancelling = true);

    final result = await _repo.cancel(reservation.id, reason: reason.isEmpty ? null : reason);

    result.fold(
      (f) {
        setState(() => _cancelling = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(f.message),
              backgroundColor: Colors.red,
            ),
          );
        }
      },
      (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Reservación cancelada'),
              backgroundColor: Colors.orange,
            ),
          );
          context.pop();
        }
      },
    );
  }

  Future<String?> _showCancelDialog() async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancelar reservación'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('¿Estás seguro de que deseas cancelar esta reservación?'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Motivo (opcional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(null),
            child: const Text('No, mantener'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(controller.text),
            child: const Text('Sí, cancelar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalle de Reservación'),
      ),
      body: FutureBuilder<Reservation>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: Colors.red),
                    const SizedBox(height: 12),
                    Text(
                      snapshot.error.toString(),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => setState(_load),
                      child: const Text('Reintentar'),
                    ),
                  ],
                ),
              ),
            );
          }

          final reservation = snapshot.data!;
          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status header
                Center(child: StatusBadge(status: reservation.status)),
                const SizedBox(height: 24),

                // Info card
                Card(
                  elevation: 2,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        _detailRow(
                          Icons.access_time,
                          'Inicio',
                          reservation.scheduledAt.toDisplayDateTime(),
                        ),
                        if (reservation.clientResourceId != null) ...[
                          const Divider(height: 20),
                          _detailRow(
                            Icons.label,
                            'Recurso',
                            _clientResourceLabel(reservation),
                          ),
                        ],
                        const Divider(height: 20),
                        _detailRow(
                          Icons.build,
                          'Servicio',
                          reservation.serviceName ?? '-',
                        ),
                        if (reservation.servicePrice != null) ...[
                          const Divider(height: 20),
                          _detailRow(
                            Icons.attach_money,
                            'Precio',
                            '\$${reservation.servicePrice}',
                          ),
                        ],
                        if (reservation.clientName != null) ...[
                          const Divider(height: 20),
                          _detailRow(
                            Icons.person,
                            'Cliente',
                            reservation.clientName!,
                          ),
                        ],
                        if (reservation.assignedTo != null) ...[
                          const Divider(height: 20),
                          _detailRow(
                            Icons.person_pin,
                            'Asignado a',
                            reservation.assignedTo!,
                          ),
                        ],
                        if (reservation.notes != null &&
                            reservation.notes!.isNotEmpty) ...[
                          const Divider(height: 20),
                          _detailRow(
                            Icons.notes,
                            'Notas',
                            reservation.notes!,
                          ),
                        ],
                      ],
                    ),
                  ),
                ),

                // Cancel section
                if (reservation.status == ReservationStatus.pending ||
                    reservation.status == ReservationStatus.confirmed) ...[
                  if (reservation.cancellationHours > 0) ...[
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.orange.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.info_outline, color: Colors.orange.shade700, size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Solo puedes cancelar con al menos ${reservation.cancellationHours} ${reservation.cancellationHours == 1 ? 'hora' : 'horas'} de anticipación.',
                              style: TextStyle(fontSize: 13, color: Colors.orange.shade800),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  if (_canCancel(reservation))
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        icon: _cancelling
                            ? const SizedBox(
                                height: 16,
                                width: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.cancel_outlined),
                        label: const Text('Cancelar reservación'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red,
                          side: const BorderSide(color: Colors.red),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: _cancelling ? null : () => _cancel(reservation),
                      ),
                    ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _detailRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: Colors.grey.shade600),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _clientResourceLabel(Reservation r) {
    return r.clientResourceLabel ?? 'Recurso';
  }
}
