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
import '../../domain/entities/available_slot.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';
import '../../domain/repositories/reservation_repository.dart';
import '../widgets/reservation_items_section.dart';
import '../widgets/slot_chip.dart';

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
  bool _rescheduling = false;

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

    return RefreshIndicator(
      onRefresh: _loadReservation,
      child: _ReservationDetailContent(
        reservation: _reservation!,
        cancelling: _cancelling,
        rescheduling: _rescheduling,
        onCancel: _cancelReservation,
        onReschedule: _rescheduleReservation,
      ),
    );
  }

  Future<void> _rescheduleReservation() async {
    final res = _reservation;
    if (res == null) return;
    if (res.serviceId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudo cargar el horario de este servicio.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    // Pick the new date — capped to 90 days out to mirror booking.
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: res.scheduledAt.isAfter(now) ? res.scheduledAt : now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 90)),
      helpText: 'Selecciona nueva fecha',
    );
    if (pickedDate == null || !mounted) return;

    // Pull slot list from the same endpoint the booking flow uses, so
    // the customer only sees options the tenant actually offers (within
    // business hours, not already taken, etc.). Duration matches the
    // current reservation so the slot search blocks overlapping rooms.
    final durationMin = res.estimatedEnd != null
        ? res.estimatedEnd!.difference(res.scheduledAt).inMinutes
        : 30;
    final dateStr = DateFormat('yyyy-MM-dd').format(pickedDate);
    final repo = getIt<ReservationRepository>();

    final slotsResult = await repo.getAvailableSlots(
      dateStr,
      res.serviceId,
      durationMin: durationMin > 0 ? durationMin : null,
    );
    if (!mounted) return;

    final List<AvailableSlot>? slots = slotsResult.fold(
      (failure) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(failure.message),
            backgroundColor: AppColors.error,
          ),
        );
        return null;
      },
      (s) => s,
    );
    if (slots == null) return;
    if (slots.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No hay horarios disponibles para esa fecha.'),
        ),
      );
      return;
    }

    if (!mounted) return;
    final picked = await showModalBottomSheet<AvailableSlot>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Horarios disponibles',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  DateFormat("EEEE d 'de' MMMM", 'es').format(pickedDate),
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 16),
                Flexible(
                  child: SingleChildScrollView(
                    child: Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: slots
                          .map((slot) => SlotChip(
                                slot: slot,
                                isSelected: false,
                                onTap: () => Navigator.pop(sheetCtx, slot),
                              ))
                          .toList(),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (picked == null || !mounted) return;

    final iso = DateFormat('yyyy-MM-dd HH:mm:ss').format(picked.start);

    setState(() => _rescheduling = true);
    final result = await repo.reschedule(widget.reservationId, scheduledAt: iso);
    if (!mounted) return;
    result.fold(
      (failure) {
        setState(() => _rescheduling = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(failure.message),
            backgroundColor: AppColors.error,
          ),
        );
      },
      (_) {
        setState(() => _rescheduling = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reserva reagendada'),
            backgroundColor: AppColors.success,
          ),
        );
        _loadReservation();
      },
    );
  }
}

class _ReservationDetailContent extends StatelessWidget {
  final Reservation reservation;
  final bool cancelling;
  final bool rescheduling;
  final VoidCallback onCancel;
  final VoidCallback onReschedule;

  const _ReservationDetailContent({
    required this.reservation,
    required this.cancelling,
    required this.rescheduling,
    required this.onCancel,
    required this.onReschedule,
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
                                // The duration badge to the right already
                                // surfaces "N min", so the customer only
                                // needs the start time here. Showing the
                                // estimated_end alongside (e.g. 15:00 -
                                // 19:40 for a 280-min booking) was
                                // visually loud and made staff scheduling
                                // look longer than the real service.
                                timeFormat.format(reservation.scheduledAt),
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

          // (Standalone service title removed — the
          // "Servicios incluidos" card below lists every item, and
          // legacy `serviceName` only ever held the first service so
          // multi-item bookings used to look like single-service ones.)
          const SizedBox(height: 0),

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
          // Owns its own Total — no separate price block needed.
          ReservationItemsSection(
            reservationId: reservation.id,
            status: reservation.status,
            scheduledAt: reservation.scheduledAt,
            tenantSlug: reservation.tenantSlug,
          ),

          const SizedBox(height: 12),

          // Pago — read-only on the customer side. Cashier records the
          // method in admin; this just tells the customer what to
          // expect at the counter.
          _PaymentStatusTile(reservation: reservation)
              .animate()
              .fadeIn(duration: 400.ms, delay: 240.ms),

          const SizedBox(height: 24),

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
            if (reservation.canReschedule) ...[
              const SizedBox(height: 12),
              AppButton(
                label: 'Reagendar',
                variant: AppButtonVariant.outline,
                onPressed: onReschedule,
                isLoading: rescheduling,
                icon: Icons.event_repeat_rounded,
              ).animate().fadeIn(duration: 400.ms, delay: 290.ms),
            ] else if (reservation.clientRescheduledAt != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.info_outline_rounded,
                      size: 18,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Ya reagendaste esta reserva. Contacta al negocio si necesitas otro cambio.',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn(duration: 400.ms, delay: 290.ms),
            ],
            const SizedBox(height: 10),
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

/// Read-only payment indicator. Either shows "Pago pendiente" with a
/// hint about when to pay, or the captured method + when + reference.
class _PaymentStatusTile extends StatelessWidget {
  final Reservation reservation;

  const _PaymentStatusTile({required this.reservation});

  String _methodLabel(String method) {
    switch (method) {
      case 'cash':
        return 'Efectivo';
      case 'card':
        return 'Tarjeta';
      case 'transfer':
        return 'Transferencia';
      default:
        return method;
    }
  }

  String? _bankLabel(String? slug) {
    if (slug == null) return null;
    const map = {
      'pichincha': 'Pichincha',
      'pacifico': 'Pacífico',
      'guayaquil': 'Guayaquil',
      'produbanco': 'Produbanco',
      'bolivariano': 'Bolivariano',
      'internacional': 'Internacional',
      'austro': 'Austro',
      'loja': 'Loja',
      'solidario': 'Solidario',
      'machala': 'Machala',
      'jep': 'JEP',
      'diners': 'Diners Club',
      'other': 'Otro banco',
    };
    return map[slug];
  }

  IconData _methodIcon(String? method) {
    switch (method) {
      case 'cash':
        return Icons.payments_outlined;
      case 'card':
        return Icons.credit_card_rounded;
      case 'transfer':
        return Icons.compare_arrows_rounded;
      default:
        return Icons.account_balance_wallet_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPaid = reservation.isPaid;
    final method = reservation.paymentMethod;
    final paidAt = reservation.paidAt;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isPaid
            ? AppColors.success.withValues(alpha: 0.08)
            : AppColors.textTertiary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isPaid
              ? AppColors.success.withValues(alpha: 0.25)
              : AppColors.textTertiary.withValues(alpha: 0.18),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            _methodIcon(method),
            size: 20,
            color: isPaid ? AppColors.success : AppColors.textTertiary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      isPaid ? 'Pagado' : 'Pago pendiente',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: isPaid ? AppColors.success : AppColors.textPrimary,
                      ),
                    ),
                    if (isPaid && method != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        method == 'transfer' && _bankLabel(reservation.paymentBank) != null
                            ? '· ${_methodLabel(method)} · ${_bankLabel(reservation.paymentBank)}'
                            : '· ${_methodLabel(method)}',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
                if (isPaid && paidAt != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Registrado ${paidAt.day}/${paidAt.month}/${paidAt.year} '
                    '${paidAt.hour.toString().padLeft(2, '0')}:${paidAt.minute.toString().padLeft(2, '0')}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textTertiary,
                    ),
                  ),
                ] else if (!isPaid) ...[
                  const SizedBox(height: 2),
                  const Text(
                    'Coordina el pago con el negocio al recoger.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textTertiary,
                    ),
                  ),
                ],
                if (reservation.paymentReference != null &&
                    reservation.paymentReference!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Ref. ${reservation.paymentReference}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textTertiary,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ],
            ),
          ),
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
