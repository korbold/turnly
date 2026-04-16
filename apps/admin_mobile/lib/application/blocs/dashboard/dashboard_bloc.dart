import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/reservation.dart';
import '../../../domain/entities/service_log.dart';
import '../../use_cases/reservations/get_reservations_use_case.dart';
import '../../use_cases/service_logs/get_service_logs_use_case.dart';
import '../../use_cases/service_logs/get_daily_summary_use_case.dart';

part 'dashboard_event.dart';
part 'dashboard_state.dart';

class DashboardBloc extends Bloc<DashboardEvent, DashboardState> {
  final GetServiceLogsUseCase _getServiceLogs;
  final GetReservationsUseCase _getReservations;
  final GetDailySummaryUseCase _getDailySummary;

  DashboardBloc({
    required GetServiceLogsUseCase getServiceLogs,
    required GetReservationsUseCase getReservations,
    required GetDailySummaryUseCase getDailySummary,
  })  : _getServiceLogs = getServiceLogs,
        _getReservations = getReservations,
        _getDailySummary = getDailySummary,
        super(const DashboardLoading()) {
    on<LoadDashboard>(_onLoad);
  }

  Future<void> _onLoad(
      LoadDashboard event, Emitter<DashboardState> emit) async {
    emit(const DashboardLoading());
    try {
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final results = await Future.wait([
        _getServiceLogs(date: today),
        _getReservations(ReservationFilters(
          dateFrom: DateTime.now(),
          status: ReservationStatus.confirmed,
        )),
        _getDailySummary(today),
      ]);

      final logsResult = results[0] as dynamic;
      final reservationsResult = results[1] as dynamic;
      final summary = results[2] as DailySummary;

      final inProgressLogs = (logsResult.data as List<ServiceLog>)
          .where((l) => l.status == 'in_progress')
          .toList();

      emit(DashboardLoaded(
        inProgressLogs: inProgressLogs,
        upcomingReservations:
            (reservationsResult.data as List<Reservation>).take(10).toList(),
        summary: summary,
      ));
    } catch (e) {
      emit(DashboardError(e.toString()));
    }
  }
}
