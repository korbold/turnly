import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../use_cases/reports/get_range_report_use_case.dart';
import '../../use_cases/reports/get_daily_report_use_case.dart';

part 'reports_event.dart';
part 'reports_state.dart';

class ReportsBloc extends Bloc<ReportsEvent, ReportsState> {
  final GetRangeReportUseCase _getRangeReport;
  final GetDailyReportUseCase _getDailyReport;

  ReportsBloc({
    required GetRangeReportUseCase getRangeReport,
    required GetDailyReportUseCase getDailyReport,
  })  : _getRangeReport = getRangeReport,
        _getDailyReport = getDailyReport,
        super(const ReportsInitial()) {
    on<LoadRangeReport>(_onLoadRange);
    on<LoadDailyReport>(_onLoadDaily);
  }

  Future<void> _onLoadRange(
      LoadRangeReport event, Emitter<ReportsState> emit) async {
    emit(const ReportsLoading());
    try {
      final data = await _getRangeReport(event.from, event.to);
      emit(ReportsLoaded(data));
    } catch (e) {
      emit(ReportsError(e.toString()));
    }
  }

  Future<void> _onLoadDaily(
      LoadDailyReport event, Emitter<ReportsState> emit) async {
    emit(const ReportsLoading());
    try {
      final data = await _getDailyReport(event.date);
      emit(ReportsLoaded(data));
    } catch (e) {
      emit(ReportsError(e.toString()));
    }
  }
}
