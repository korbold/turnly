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
import '../../../../shared/widgets/status_badge.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/repositories/reservation_repository.dart';

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

  Future<void> _cancelReservation() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Cancelar reserva',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        content: const Text(
          'Estas seguro de que deseas cancelar esta reserva? Esta accion no se puede deshacer.',
          style: TextStyle(
            fontSize: 14,
            color: AppColors.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No, mantener'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Si, cancelar'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _cancelling = true);

    final repo = getIt<ReservationRepository>();
    final result = await repo.cancel(widget.reservationId);

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
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Detalle de reserva',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
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
            const ShimmerLoader(height: 48),
            const SizedBox(height: 20),
            const ShimmerLoader(height: 28, width: 200),
            const SizedBox(height: 24),
            ShimmerLoader.list(count: 4, itemHeight: 56),
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
    final dateFormat = DateFormat("EEEE d 'de' MMMM, yyyy", 'es');
    final timeFormat = DateFormat('HH:mm');

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status badge (prominent)
          Center(
            child: StatusBadge(
              label: reservation.status.label,
              color: reservation.status.color,
            ),
          ).animate().fadeIn(duration: 400.ms).scale(
                begin: const Offset(0.9, 0.9),
                end: const Offset(1, 1),
                duration: 400.ms,
              ),

          const SizedBox(height: 20),

          // Service name as title
          Center(
            child: Text(
              reservation.serviceName ?? 'Servicio',
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
          ).animate().fadeIn(duration: 400.ms, delay: 50.ms),

          if (reservation.tenantName != null) ...[
            const SizedBox(height: 4),
            Center(
              child: Text(
                reservation.tenantName!,
                style: const TextStyle(
                  fontSize: 15,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ).animate().fadeIn(duration: 400.ms, delay: 100.ms),
          ],

          const SizedBox(height: 28),

          // Detail card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                _DetailRow(
                  icon: Icons.calendar_today_rounded,
                  label: 'Fecha',
                  value: dateFormat.format(reservation.scheduledAt),
                ),
                const Divider(height: 24),
                _DetailRow(
                  icon: Icons.access_time_rounded,
                  label: 'Hora',
                  value: reservation.estimatedEnd != null
                      ? '${timeFormat.format(reservation.scheduledAt)} - ${timeFormat.format(reservation.estimatedEnd!)}'
                      : timeFormat.format(reservation.scheduledAt),
                ),
                if (reservation.tenantName != null) ...[
                  const Divider(height: 24),
                  _DetailRow(
                    icon: Icons.store_outlined,
                    label: 'Negocio',
                    value: reservation.tenantName!,
                  ),
                ],
                if (reservation.clientResourceLabel != null) ...[
                  const Divider(height: 24),
                  _DetailRow(
                    icon: Icons.badge_outlined,
                    label: 'Registro',
                    value: reservation.clientResourceLabel!,
                  ),
                ],
                if (reservation.servicePrice != null) ...[
                  const Divider(height: 24),
                  _DetailRow(
                    icon: Icons.attach_money_rounded,
                    label: 'Precio',
                    value: reservation.servicePrice!,
                  ),
                ],
                if (reservation.notes != null &&
                    reservation.notes!.isNotEmpty) ...[
                  const Divider(height: 24),
                  _DetailRow(
                    icon: Icons.notes_rounded,
                    label: 'Notas',
                    value: reservation.notes!,
                  ),
                ],
              ],
            ),
          ).animate().fadeIn(duration: 400.ms, delay: 150.ms).slideY(
                begin: 0.03,
                end: 0,
                duration: 400.ms,
                delay: 150.ms,
              ),

          const SizedBox(height: 32),

          // Cancel button
          if (reservation.canCancel)
            AppButton(
              label: 'Cancelar Reserva',
              variant: AppButtonVariant.outline,
              color: AppColors.error,
              onPressed: onCancel,
              isLoading: cancelling,
              icon: Icons.cancel_outlined,
            ).animate().fadeIn(duration: 400.ms, delay: 250.ms),

          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AppColors.accentLight,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.accent, size: 18),
        ),
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
    );
  }
}
