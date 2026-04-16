import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../application/blocs/reservations/reservations_bloc.dart';
import '../../../domain/entities/reservation.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';
import '../../../shared/constants/status.dart';
import 'widgets/reservation_card.dart';
import 'widgets/timeline_view.dart';

class ReservationsPage extends StatelessWidget {
  const ReservationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<ReservationsBloc>(),
      child: const _ReservationsView(),
    );
  }
}

class _ReservationsView extends StatefulWidget {
  const _ReservationsView();

  @override
  State<_ReservationsView> createState() => _ReservationsViewState();
}

class _ReservationsViewState extends State<_ReservationsView> {
  DateTime _selectedDate = DateTime.now();
  ReservationStatus? _selectedStatus;
  bool _isTimelineView = true;

  @override
  void initState() {
    super.initState();
    _loadReservations();
  }

  void _loadReservations() {
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    context.read<ReservationsBloc>().add(LoadReservations(
          ReservationFilters(
            dateFrom: DateTime.parse('$dateStr 00:00:00'),
            dateTo: DateTime.parse('$dateStr 23:59:59'),
            status: _selectedStatus,
          ),
        ));
  }

  void _changeDate(int delta) {
    setState(() {
      _selectedDate = _selectedDate.add(Duration(days: delta));
    });
    _loadReservations();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _loadReservations();
    }
  }

  String _dateLabel() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final selected =
        DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day);
    if (selected == today) return 'Hoy';
    if (selected == today.add(const Duration(days: 1))) return 'Manana';
    if (selected == today.subtract(const Duration(days: 1))) return 'Ayer';
    return DateFormat("d MMM yyyy", 'es').format(_selectedDate);
  }

  void _onSwipeAction(Reservation r) {
    final bloc = context.read<ReservationsBloc>();
    switch (r.status) {
      case ReservationStatus.pending:
        bloc.add(TransitionReservation(
          id: r.id,
          action: ReservationAction.confirm,
        ));
        break;
      case ReservationStatus.confirmed:
        _showCancelDialog(r.id);
        break;
      case ReservationStatus.inProgress:
        bloc.add(TransitionReservation(
          id: r.id,
          action: ReservationAction.complete,
        ));
        break;
      default:
        break;
    }
  }

  void _showCancelDialog(int reservationId) {
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
                context.read<ReservationsBloc>().add(CancelReservation(
                      id: reservationId,
                      reason: controller.text.trim(),
                    ));
                Navigator.pop(ctx);
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.error,
            ),
            child: const Text('Cancelar Reserva'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Text(
                    'Reservas',
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontSize: 22),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: Icon(
                      _isTimelineView ? Icons.view_list : Icons.timeline,
                      color: AppColors.textSecondary,
                    ),
                    onPressed: () =>
                        setState(() => _isTimelineView = !_isTimelineView),
                    tooltip:
                        _isTimelineView ? 'Vista lista' : 'Vista timeline',
                  ),
                ],
              ),
            ),

            // Date selector
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.chevron_left),
                    onPressed: () => _changeDate(-1),
                    visualDensity: VisualDensity.compact,
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: _pickDate,
                      child: Text(
                        _dateLabel(),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.chevron_right),
                    onPressed: () => _changeDate(1),
                    visualDensity: VisualDensity.compact,
                  ),
                  IconButton(
                    icon: const Icon(Icons.calendar_today, size: 20),
                    onPressed: _pickDate,
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ),

            // Status filter chips
            SizedBox(
              height: 40,
              child: BlocBuilder<ReservationsBloc, ReservationsState>(
                builder: (context, state) {
                  final reservations =
                      state is ReservationsLoaded ? state.result.data : <Reservation>[];
                  return ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    children: [
                      _FilterChip(
                        label: 'Todas',
                        count: reservations.length,
                        isSelected: _selectedStatus == null,
                        onTap: () {
                          setState(() => _selectedStatus = null);
                          _loadReservations();
                        },
                      ),
                      ...ReservationStatus.values
                          .where((s) =>
                              s != ReservationStatus.cancelled &&
                              s != ReservationStatus.noShow)
                          .map((status) {
                        final cfg = reservationStatusConfig[status.apiValue];
                        final count = reservations
                            .where((r) => r.status == status)
                            .length;
                        return _FilterChip(
                          label: cfg?.label ?? status.apiValue,
                          count: count,
                          isSelected: _selectedStatus == status,
                          color: cfg?.color,
                          onTap: () {
                            setState(() => _selectedStatus =
                                _selectedStatus == status ? null : status);
                            _loadReservations();
                          },
                        );
                      }),
                    ],
                  );
                },
              ),
            ),

            const SizedBox(height: 8),

            // Content
            Expanded(
              child: BlocBuilder<ReservationsBloc, ReservationsState>(
                builder: (context, state) {
                  if (state is ReservationsLoading) {
                    return const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                      ),
                    );
                  }

                  if (state is ReservationsError) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.error_outline,
                              color: AppColors.error, size: 40),
                          const SizedBox(height: 12),
                          Text(
                            state.message,
                            style: const TextStyle(color: AppColors.textMuted),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: _loadReservations,
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('Reintentar'),
                          ),
                        ],
                      ),
                    );
                  }

                  if (state is ReservationsLoaded) {
                    final items = state.result.data;
                    final filtered = _selectedStatus != null
                        ? items
                            .where((r) => r.status == _selectedStatus)
                            .toList()
                        : items;

                    if (_isTimelineView) {
                      return RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: () async {
                          _loadReservations();
                          await context
                              .read<ReservationsBloc>()
                              .stream
                              .firstWhere((s) => s is! ReservationsLoading);
                        },
                        child: SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: TimelineView(
                            reservations: filtered,
                            onSwipeAction: _onSwipeAction,
                          ),
                        ),
                      );
                    }

                    return RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () async {
                        _loadReservations();
                        await context
                            .read<ReservationsBloc>()
                            .stream
                            .firstWhere((s) => s is! ReservationsLoading);
                      },
                      child: filtered.isEmpty
                          ? ListView(
                              children: [
                                SizedBox(
                                  height:
                                      MediaQuery.of(context).size.height * 0.4,
                                  child: const Center(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.event_available,
                                            size: 48,
                                            color: AppColors.textMuted),
                                        SizedBox(height: 12),
                                        Text(
                                          'Sin reservas para esta fecha',
                                          style: TextStyle(
                                              color: AppColors.textMuted),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 4),
                              itemCount: filtered.length,
                              itemBuilder: (context, index) {
                                final r = filtered[index];
                                return ReservationCard(
                                  reservation: r,
                                  onSwipeAction: () => _onSwipeAction(r),
                                );
                              },
                            ),
                    );
                  }

                  return const SizedBox.shrink();
                },
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/reservations/create'),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final int count;
  final bool isSelected;
  final Color? color;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.count,
    required this.isSelected,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? AppColors.primary;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected
                ? chipColor.withValues(alpha: 0.15)
                : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? chipColor : AppColors.cardBorder,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  color: isSelected ? chipColor : AppColors.textSecondary,
                ),
              ),
              if (count > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? chipColor
                        : AppColors.textMuted.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$count',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? Colors.white : AppColors.textMuted,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
