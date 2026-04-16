part of 'dashboard_bloc.dart';

abstract class DashboardState extends Equatable {
  const DashboardState();

  @override
  List<Object?> get props => [];
}

class DashboardLoading extends DashboardState {
  const DashboardLoading();
}

class DashboardLoaded extends DashboardState {
  final List<ServiceLog> inProgressLogs;
  final List<Reservation> upcomingReservations;
  final DailySummary? summary;

  const DashboardLoaded({
    required this.inProgressLogs,
    required this.upcomingReservations,
    this.summary,
  });

  @override
  List<Object?> get props => [inProgressLogs, upcomingReservations, summary];
}

class DashboardError extends DashboardState {
  final String message;

  const DashboardError(this.message);

  @override
  List<Object?> get props => [message];
}
