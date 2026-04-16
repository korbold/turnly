part of 'service_logs_bloc.dart';

abstract class ServiceLogsState extends Equatable {
  const ServiceLogsState();

  @override
  List<Object?> get props => [];
}

class ServiceLogsInitial extends ServiceLogsState {
  const ServiceLogsInitial();
}

class ServiceLogsLoading extends ServiceLogsState {
  const ServiceLogsLoading();
}

class ServiceLogsLoaded extends ServiceLogsState {
  final PaginatedResult<ServiceLog> logs;
  final DailySummary? summary;

  const ServiceLogsLoaded({required this.logs, this.summary});

  @override
  List<Object?> get props => [logs, summary];
}

class ServiceLogsError extends ServiceLogsState {
  final String message;

  const ServiceLogsError(this.message);

  @override
  List<Object?> get props => [message];
}
