// lib/features/reservations/presentation/screens/reservation_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/shimmer_loader.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';
import '../../domain/repositories/reservation_repository.dart';
import '../widgets/reservation_items_section.dart';

class ReservationDetailScreen extends StatefulWidget {
  final String reservationId;

  const ReservationDetailScreen({super.key, required this.reservationId});

  @override
  State<ReservationDetailScreen> createState() =>
      _ReservationDetailScreenState();
}

class _ReservationDetailScreenState extends State<ReservationDetailScreen> {
  Reservation? _reservation;
  String? _error;
  bool _loading = true;
  bool _cancelling = false;

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

    final repo = getIt<ReservationRepository>();
    final result = await repo.getById(widget.reservationId);

    if (!mounted) return;

    result.fold(
      (failure) => setState(() {
        _error = failure.message;
        _loading = false;
      }),
      (reservation) => setState(() {
        _reservation = reservation;
        _loading = false;
      }),
    );
  }

  static const _cancelReasons = [
    'Tengo un imprevisto',
    'Ya no necesito el servicio',
    'Cambio de horario',
    'Problemas de transporte',
    'Error al reservar',
    'Otro motivo',
  ];

  Future<void> _cancelReservation() async {
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        String? selected;
        return StatefulBuilder(
          builder: (ctx, setDialogState) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: const Text(
              'Cancelar reserva',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Selecciona el motivo de cancelacion:',
                  style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 12),
                ..._cancelReasons.map((r) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: InkWell(
                    onTap: () => setDialogState(() => selected = r),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: selected == r
                            ? AppColors.error.withValues(alpha: 0.08)
                            : AppColors.background,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: selected == r
                              ? AppColors.error.withValues(alpha: 0.4)
                              : AppColors.border,
                        ),
                      ),
                      child: Text(
                        r,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: selected == r ? FontWeight.w600 : FontWeight.w400,
                          color: selected == r ? AppColors.error : AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                )),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('No, mantener'),
              ),
              TextButton(
                onPressed: selected != null ? () => Navigator.pop(ctx, selected) : null,
                style: TextButton.styleFrom(foregroundColor: AppColors.error),
                child: const Text('Si, cancelar'),
              ),
            ],
          ),
        );
      },
    );

    if (reason == null || !mounted) return;

    setState(() => _cancelling = true);

    final repo = getIt<ReservationRepository>();
    final result = await repo.cancel(widget.reservationId, reason: reason);

    if (!mounted) return;

    result.fold(
      (failure) {
        setState(() => _cancelling = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(failure.message),
            backgroundColor: AppColors.error,
          ),
        );
      },
      (_) {
        setState(() => _cancelling = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reserva cancelada'),
            backgroundColor: AppColors.success,
          ),
        );
        _loadReservation();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              context.pop();
            } else {
              context.go('/reservations');
            }
          },
        ),
        title: const Text(
          'Detalle',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: true,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const ShimmerLoader(height: 180),
            const SizedBox(height: 20),
            ShimmerLoader.list(count: 4, itemHeight: 48),
          ],
        ),
      );
    }

    if (_error != null) {
      return EmptyState(
        icon: Icons.error_outline_rounded,
        title: 'Error al cargar reserva',
        subtitle: _error,
        actionLabel: 'Reintentar',
        onAction: _loadReservation,
      );
    }

    if (_reservation == null) return const SizedBox.shrink();

    return _ReservationDetailContent(
      reservation: _reservation!,
      cancelling: _cancelling,
      onCancel: _cancelReservation,
    );
  }
}

class _ReservationDetailContent extends StatelessWidget {
  final Reservation reservation;
  final bool cancelling;
  final VoidCallback onCancel;

  const _ReservationDetailContent({
    required this.reservation,
    required this.cancelling,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat("EEEE,\nd 'de' MMMM yyyy", 'es');
    final timeFormat = DateFormat('HH:mm');
    final statusColor = reservation.status.color;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero card — date + duration
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  statusColor.withValues(alpha: 0.08),
                  statusColor.withValues(alpha: 0.03),
                ],
              ),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: statusColor.withValues(alpha: 0.15)),
            ),
            child: Column(
              children: [
                // Status chip
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: reservation.status.backgroundColor,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        reservation.status.label,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: statusColor,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Date
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            dateFormat.format(reservation.scheduledAt),
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                              height: 1.3,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Icon(Icons.access_time_rounded, size: 16, color: statusColor),
                              const SizedBox(width: 6),
                              Text(
                                reservation.estimatedEnd != null
                                    ? '${timeFormat.format(reservation.scheduledAt)} - ${timeFormat.format(reservation.estimatedEnd!)}'
                                    : timeFormat.format(reservation.scheduledAt),
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: statusColor,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Duration badge
                    if (reservation.estimatedEnd != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.06),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            Text(
                              '${reservation.estimatedEnd!.difference(reservation.scheduledAt).inMinutes}',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const Text(
                              'min',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ).animate().fadeIn(duration: 400.ms).slideY(
                begin: 0.05,
                end: 0,
                duration: 400.ms,
              ),

          const SizedBox(height: 24),

          // Service name
          Text(
            reservation.serviceName ?? 'Servicio',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ).animate().fadeIn(duration: 400.ms, delay: 50.ms),

          const SizedBox(height: 20),

          // Details list
          _InfoTile(
            icon: Icons.store_outlined,
            label: 'Negocio',
            value: reservation.tenantName ?? '-',
          ).animate().fadeIn(duration: 400.ms, delay: 100.ms),

          if (reservation.clientResourceLabel != null)
            _InfoTile(
              icon: Icons.badge_outlined,
              label: 'Registro',
              value: reservation.clientResourceLabel!,
            ).animate().fadeIn(duration: 400.ms, delay: 150.ms),

          if (reservation.notes != null && reservation.notes!.isNotEmpty)
            _InfoTile(
              icon: Icons.notes_rounded,
              label: 'Notas',
              value: reservation.notes!,
            ).animate().fadeIn(duration: 400.ms, delay: 200.ms),

          const SizedBox(height: 16),

          // Items panel (Phase 3.5): listed + editable while pending/confirmed.
          ReservationItemsSection(
            reservationId: reservation.id,
            status: reservation.status,
            scheduledAt: reservation.scheduledAt,
            tenantSlug: reservation.tenantSlug,
          ),

          // Price summary
          if (reservation.servicePrice != null) ...[
            const Divider(),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Total',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
                Text(
                  '\$${reservation.servicePrice}',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ).animate().fadeIn(duration: 400.ms, delay: 250.ms),
            const SizedBox(height: 24),
          ],

          // Cancellation policy notice
          if (reservation.status == ReservationStatus.pending || reservation.status == ReservationStatus.confirmed) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: reservation.canCancel
                    ? AppColors.warning.withValues(alpha: 0.08)
                    : AppColors.error.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: reservation.canCancel
                      ? AppColors.warning.withValues(alpha: 0.3)
                      : AppColors.error.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 18,
                    color: reservation.canCancel ? AppColors.warning : AppColors.error,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      reservation.canCancel
                          ? (reservation.cancellationHours > 0
                              ? 'Puedes cancelar hasta ${reservation.cancellationHours == 1 ? "1 hora" : "${reservation.cancellationHours} horas"} antes de tu cita'
                              : 'Puedes cancelar en cualquier momento antes de tu cita')
                          : 'Ya no es posible cancelar (limite: ${reservation.cancellationHours}h antes)',
                      style: TextStyle(
                        fontSize: 12,
                        color: reservation.canCancel
                            ? AppColors.warning.withValues(alpha: 0.9)
                            : AppColors.error.withValues(alpha: 0.8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 400.ms, delay: 280.ms),
          ],
          if (reservation.canCancel) ...[
            const SizedBox(height: 12),
            AppButton(
              label: 'Cancelar Reserva',
              variant: AppButtonVariant.primary,
              color: AppColors.error,
              onPressed: onCancel,
              isLoading: cancelling,
              icon: Icons.cancel_outlined,
            ).animate().fadeIn(duration: 400.ms, delay: 300.ms),
          ],

          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: AppColors.textTertiary),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textTertiary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
