import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../application/blocs/reservations/reservations_bloc.dart';
import '../../../application/use_cases/reservations/get_reservation_use_case.dart';
import '../../../domain/entities/reservation.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';
import '../../../shared/constants/status.dart';

class ReservationDetailPage extends StatefulWidget {
  final String reservationId;

  const ReservationDetailPage({super.key, required this.reservationId});

  @override
  State<ReservationDetailPage> createState() => _ReservationDetailPageState();
}

class _ReservationDetailPageState extends State<ReservationDetailPage> {
  Reservation? _reservation;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadReservation();
  }

  Future<void> _loadReservation() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final id = int.parse(widget.reservationId);
      final r = await getIt<GetReservationUseCase>().call(id);
      if (mounted) setState(() { _reservation = r; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  StatusConfig _statusCfg(Reservation r) =>
      reservationStatusConfig[r.status.apiValue] ??
      const StatusConfig(
        label: '?',
        color: AppColors.textMuted,
        bgColor: AppColors.background,
      );

  void _transition(ReservationAction action) {
    final id = int.parse(widget.reservationId);
    context.read<ReservationsBloc>().add(
          TransitionReservation(id: id, action: action),
        );
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Actualizando reserva...')),
    );
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) _loadReservation();
    });
  }

  void _showCancelDialog() {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancelar Reserva'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Motivo de cancelacion',
            hintText: 'Ingrese el motivo...',
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Volver'),
          ),
          FilledButton(
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                final id = int.parse(widget.reservationId);
                context.read<ReservationsBloc>().add(CancelReservation(
                      id: id,
                      reason: controller.text.trim(),
                    ));
                Navigator.pop(ctx);
                Future.delayed(const Duration(milliseconds: 500), () {
                  if (mounted) _loadReservation();
                });
              }
            },
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Cancelar Reserva'),
          ),
        ],
      ),
    );
  }

  void _markNoShow() {
    // no_show is typically a cancel with a specific reason
    final id = int.parse(widget.reservationId);
    context.read<ReservationsBloc>().add(CancelReservation(
          id: id,
          reason: 'No show - cliente no se presento',
        ));
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) _loadReservation();
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<ReservationsBloc>(),
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text('Reserva #${widget.reservationId}'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.pop(),
          ),
        ),
        body: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary))
            : _error != null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline,
                            color: AppColors.error, size: 40),
                        const SizedBox(height: 12),
                        Text(_error!,
                            style:
                                const TextStyle(color: AppColors.textMuted)),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: _loadReservation,
                          icon: const Icon(Icons.refresh, size: 18),
                          label: const Text('Reintentar'),
                        ),
                      ],
                    ),
                  )
                : _buildContent(context, _reservation!),
      ),
    );
  }

  Widget _buildContent(BuildContext context, Reservation r) {
    final cfg = _statusCfg(r);
    final dateFormat = DateFormat("EEEE d 'de' MMMM, yyyy", 'es');
    final timeFormat = DateFormat('HH:mm');

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => _loadReservation(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Status badge large
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              decoration: BoxDecoration(
                color: cfg.bgColor,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: cfg.color,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    cfg.label,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: cfg.color,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Action buttons
          _buildActions(r),
          const SizedBox(height: 24),

          // Info sections
          _infoSection(
            icon: Icons.person_outline,
            title: 'Cliente',
            rows: [
              _InfoRow('Nombre', r.clientName ?? '---'),
              _InfoRow('Email', r.clientEmail ?? '---'),
            ],
          ),
          const SizedBox(height: 12),
          _infoSection(
            icon: Icons.directions_car_outlined,
            title: 'Recurso',
            rows: [
              _InfoRow('Placa', r.clientResourcePlate ?? '---'),
              _InfoRow('Etiqueta', r.clientResourceLabel ?? '---'),
            ],
          ),
          const SizedBox(height: 12),
          _infoSection(
            icon: Icons.local_car_wash,
            title: 'Servicio',
            rows: [
              _InfoRow('Nombre', r.serviceName ?? '---'),
              _InfoRow('Precio',
                  r.servicePrice != null ? '\$${r.servicePrice!.toStringAsFixed(2)}' : '---'),
            ],
          ),
          const SizedBox(height: 12),
          _infoSection(
            icon: Icons.access_time,
            title: 'Horario',
            rows: [
              _InfoRow('Fecha', dateFormat.format(r.scheduledAt)),
              _InfoRow('Hora',
                  '${timeFormat.format(r.scheduledAt)} - ${timeFormat.format(r.estimatedEnd)}'),
            ],
          ),
          if (r.notes != null && r.notes!.isNotEmpty) ...[
            const SizedBox(height: 12),
            _infoSection(
              icon: Icons.notes,
              title: 'Notas',
              rows: [_InfoRow(null, r.notes!)],
            ),
          ],
          if (r.cancelReason != null) ...[
            const SizedBox(height: 12),
            _infoSection(
              icon: Icons.block,
              title: 'Motivo de Cancelacion',
              rows: [_InfoRow(null, r.cancelReason!)],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildActions(Reservation r) {
    switch (r.status) {
      case ReservationStatus.pending:
        return Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () => _transition(ReservationAction.confirm),
                icon: const Icon(Icons.check, size: 18),
                label: const Text('Confirmar'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.statusConfirmed,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _showCancelDialog,
                icon: const Icon(Icons.close, size: 18),
                label: const Text('Cancelar'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: const BorderSide(color: AppColors.error),
                ),
              ),
            ),
          ],
        );
      case ReservationStatus.confirmed:
        return Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _transition(ReservationAction.start),
                    icon: const Icon(Icons.play_arrow, size: 18),
                    label: const Text('Iniciar'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _showCancelDialog,
                    icon: const Icon(Icons.close, size: 18),
                    label: const Text('Cancelar'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: AppColors.error),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _markNoShow,
                icon: const Icon(Icons.person_off_outlined, size: 18),
                label: const Text('No Show'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.statusNoShow,
                  side: const BorderSide(color: AppColors.statusNoShow),
                ),
              ),
            ),
          ],
        );
      case ReservationStatus.inProgress:
        return SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () => _transition(ReservationAction.complete),
            icon: const Icon(Icons.done_all, size: 18),
            label: const Text('Completar'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.statusCompleted,
            ),
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _infoSection({
    required IconData icon,
    required String title,
    required List<_InfoRow> rows,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...rows.map((row) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: row.label != null
                    ? Row(
                        children: [
                          SizedBox(
                            width: 80,
                            child: Text(
                              row.label!,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              row.value,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      )
                    : Text(
                        row.value,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
              )),
        ],
      ),
    );
  }
}

class _InfoRow {
  final String? label;
  final String value;
  const _InfoRow(this.label, this.value);
}
