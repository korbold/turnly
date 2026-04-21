// lib/features/reservations/presentation/screens/reservations_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/shimmer_loader.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';
import '../../domain/repositories/reservation_repository.dart';
import '../cubit/reservations_cubit.dart';
import '../cubit/reservations_state.dart';
import '../widgets/reservation_card.dart';

class ReservationsScreen extends StatelessWidget {
  const ReservationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) =>
          ReservationsCubit(getIt<ReservationRepository>())
            ..loadReservations(),
      child: const _ReservationsView(),
    );
  }
}

class _ReservationsView extends StatelessWidget {
  const _ReservationsView();

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.surface,
          elevation: 0,
          title: const Text(
            'Mis Reservas',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          centerTitle: false,
          bottom: TabBar(
            labelColor: AppColors.accent,
            unselectedLabelColor: AppColors.textSecondary,
            indicatorColor: AppColors.accent,
            indicatorWeight: 3,
            labelStyle: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
            tabs: const [
              Tab(text: 'Proximas'),
              Tab(text: 'Completadas'),
              Tab(text: 'Canceladas'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _ReservationTabContent(
              filter: (r) => r.status.isUpcoming,
              ascending: true,
              emptyIcon: Icons.calendar_today_rounded,
              emptyTitle: 'Sin reservas proximas',
              emptySubtitle: 'Tus proximas reservas apareceran aqui',
            ),
            _ReservationTabContent(
              filter: (r) => r.status == ReservationStatus.completed,
              emptyIcon: Icons.check_circle_outline_rounded,
              emptyTitle: 'Sin reservas completadas',
              emptySubtitle: 'Las reservas que completes apareceran aqui',
            ),
            _ReservationTabContent(
              filter: (r) => r.status == ReservationStatus.cancelled,
              emptyIcon: Icons.cancel_outlined,
              emptyTitle: 'Sin reservas canceladas',
              emptySubtitle: 'Las reservas que canceles apareceran aqui',
            ),
          ],
        ),
      ),
    );
  }
}

class _ReservationTabContent extends StatelessWidget {
  final bool Function(Reservation) filter;
  final IconData emptyIcon;
  final String emptyTitle;
  final String emptySubtitle;
  final bool ascending;

  const _ReservationTabContent({
    required this.filter,
    required this.emptyIcon,
    required this.emptyTitle,
    required this.emptySubtitle,
    this.ascending = false,
  });

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReservationsCubit, ReservationsState>(
      builder: (context, state) {
        if (state is ReservationsLoading || state is ReservationsInitial) {
          return Padding(
            padding: const EdgeInsets.all(20),
            child: ShimmerLoader.list(count: 4, itemHeight: 100),
          );
        }

        if (state is ReservationsError) {
          return EmptyState(
            icon: Icons.error_outline_rounded,
            title: 'Error al cargar reservas',
            subtitle: state.message,
            actionLabel: 'Reintentar',
            onAction: () =>
                context.read<ReservationsCubit>().loadReservations(),
          );
        }

        if (state is ReservationsLoaded) {
          final filtered = state.reservations.where(filter).toList()
            ..sort((a, b) => ascending
                ? a.scheduledAt.compareTo(b.scheduledAt)
                : b.scheduledAt.compareTo(a.scheduledAt));

          if (filtered.isEmpty) {
            return EmptyState(
              icon: emptyIcon,
              title: emptyTitle,
              subtitle: emptySubtitle,
            );
          }

          return RefreshIndicator(
            color: AppColors.accent,
            onRefresh: () async {
              context.read<ReservationsCubit>().loadReservations();
            },
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.all(20),
              itemCount: filtered.length,
              itemBuilder: (context, index) {
                final reservation = filtered[index];
                return ReservationCard(
                  reservation: reservation,
                  index: index,
                  onTap: () => context.push('/reservations/${reservation.id}'),
                );
              },
            ),
          );
        }

        return const SizedBox.shrink();
      },
    );
  }
}
