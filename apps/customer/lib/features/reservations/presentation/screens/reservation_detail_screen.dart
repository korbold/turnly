// features/reservations/presentation/screens/reservation_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../infrastructure/reservation_repository_impl.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';
import '../../../../shared/extensions/date_extensions.dart';
import '../../../../core/theme/app_theme.dart';

class ReservationDetailScreen extends StatefulWidget {
  final String reservationId;
  const ReservationDetailScreen({super.key, required this.reservationId});

  @override
  State<ReservationDetailScreen> createState() => _ReservationDetailScreenState();
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
    _future = _repo.getById(widget.reservationId).then((result) => result.fold((f) => throw f.message, (r) => r));
  }

  bool _canCancel(Reservation reservation) {
    if (reservation.status != ReservationStatus.pending && reservation.status != ReservationStatus.confirmed) return false;
    if (reservation.cancellationHours <= 0) return true;
    return reservation.scheduledAt.difference(DateTime.now()).inMinutes >= (reservation.cancellationHours * 60);
  }

  Future<void> _cancel(Reservation reservation) async {
    final controller = TextEditingController();
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Cancelar cita', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.darkText)),
            const SizedBox(height: 8),
            const Text('Estas seguro? Esta accion no se puede deshacer.', style: TextStyle(color: AppColors.bodyText)),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              decoration: const InputDecoration(labelText: 'Motivo (opcional)'),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(ctx).pop(null),
                    child: const Text('No, mantener'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                    onPressed: () => Navigator.of(ctx).pop(controller.text),
                    child: const Text('Si, cancelar'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    if (reason == null) return;

    setState(() => _cancelling = true);
    final result = await _repo.cancel(reservation.id, reason: reason.isEmpty ? null : reason);
    result.fold(
      (f) {
        setState(() => _cancelling = false);
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message), backgroundColor: AppColors.error));
      },
      (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Cita cancelada'), backgroundColor: Colors.orange));
          context.pop();
        }
      },
    );
  }

  IconData _statusIcon(ReservationStatus status) {
    switch (status) {
      case ReservationStatus.pending: return Icons.schedule;
      case ReservationStatus.confirmed: return Icons.check_circle_outline;
      case ReservationStatus.inProgress: return Icons.play_circle_outline;
      case ReservationStatus.completed: return Icons.task_alt;
      case ReservationStatus.cancelled: return Icons.cancel_outlined;
      case ReservationStatus.noShow: return Icons.person_off_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Detalle')),
      body: FutureBuilder<Reservation>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                  const SizedBox(height: 12),
                  Text(snapshot.error.toString(), textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  OutlinedButton(onPressed: () => setState(_load), child: const Text('Reintentar')),
                ],
              ),
            );
          }

          final r = snapshot.data!;
          final canCancel = _canCancel(r);

          return Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  child: Column(
                    children: [
                      // Status header
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        decoration: BoxDecoration(
                          color: r.status.color.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Column(
                          children: [
                            Icon(_statusIcon(r.status), size: 40, color: r.status.color),
                            const SizedBox(height: 8),
                            Text(r.status.label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: r.status.color)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Info sections
                      _infoRow(Icons.calendar_today, AppColors.primary, 'Cuando', r.scheduledAt.toDisplayDateTime()),
                      if (r.tenantName != null) _infoRow(Icons.store, const Color(0xFF059669), 'Donde', r.tenantName!),
                      _infoRow(Icons.build_outlined, const Color(0xFF8B5CF6), 'Servicio', '${r.serviceName ?? "-"}${r.servicePrice != null ? "  ·  \$${r.servicePrice}" : ""}'),
                      if (r.clientResourceId != null) _infoRow(Icons.directions_car, const Color(0xFF2563EB), 'Recurso', r.clientResourceLabel ?? 'Recurso'),
                      if (r.assignedTo != null) _infoRow(Icons.person_pin, const Color(0xFFEA580C), 'Atendido por', r.assignedTo!),
                      if (r.notes != null && r.notes!.isNotEmpty) _infoRow(Icons.notes, AppColors.bodyText, 'Notas', r.notes!),
                    ],
                  ),
                ),
              ),

              // Cancel footer
              if (canCancel)
                Container(
                  padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).padding.bottom + 16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, -2))],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: _cancelling ? null : () => _cancel(r),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.error,
                            side: const BorderSide(color: AppColors.error),
                          ),
                          child: _cancelling
                              ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Text('Cancelar cita'),
                        ),
                      ),
                      if (r.cancellationHours > 0) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Puedes cancelar hasta ${r.cancellationHours} ${r.cancellationHours == 1 ? "hora" : "horas"} antes',
                          style: const TextStyle(fontSize: 12, color: AppColors.bodyText),
                        ),
                      ],
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _infoRow(IconData icon, Color color, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.darkText)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
