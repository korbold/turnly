import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../application/blocs/auth/auth_bloc.dart';
import '../../../application/blocs/dashboard/dashboard_bloc.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';
import 'widgets/live_tracker_widget.dart';
import 'widgets/quick_actions.dart';
import 'widgets/revenue_cards.dart';
import 'widgets/upcoming_reservations.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<DashboardBloc>()..add(const LoadDashboard()),
      child: const _DashboardView(),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView();

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Buenos dias';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final userName =
        authState is AuthAuthenticated ? authState.user.name : '';
    final tenantName =
        authState is AuthAuthenticated ? authState.tenant?.name : null;
    final today = DateFormat("EEEE d 'de' MMMM", 'es').format(DateTime.now());

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: BlocBuilder<DashboardBloc, DashboardState>(
          builder: (context, state) {
            return RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async {
                context.read<DashboardBloc>().add(const LoadDashboard());
                // Wait for the bloc to emit a non-loading state
                await context.read<DashboardBloc>().stream.firstWhere(
                    (s) => s is! DashboardLoading);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: [
                  // Greeting header
                  Text(
                    '${_greeting()}, ${userName.split(' ').first}',
                    style: Theme.of(context)
                        .textTheme
                        .headlineLarge
                        ?.copyWith(fontSize: 24),
                  ),
                  if (tenantName != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      tenantName,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w500,
                          ),
                    ),
                  ],
                  const SizedBox(height: 2),
                  Text(
                    today,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 24),

                  // Quick actions
                  const QuickActions(),
                  const SizedBox(height: 24),

                  // Revenue cards
                  if (state is DashboardLoaded) ...[
                    RevenueCards(summary: state.summary),
                    const SizedBox(height: 24),

                    // Live tracker
                    LiveTrackerWidget(logs: state.inProgressLogs),
                    const SizedBox(height: 24),

                    // Upcoming reservations
                    UpcomingReservations(
                        reservations: state.upcomingReservations),
                  ] else if (state is DashboardLoading) ...[
                    const SizedBox(
                      height: 200,
                      child: Center(
                        child: CircularProgressIndicator(
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ] else if (state is DashboardError) ...[
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: AppColors.errorMuted,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.error_outline,
                              color: AppColors.error, size: 40),
                          const SizedBox(height: 12),
                          Text(
                            'Error al cargar el dashboard',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(color: AppColors.error),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            state.message,
                            style: Theme.of(context).textTheme.bodySmall,
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
