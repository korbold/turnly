import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/service_log.dart';
import '../../../shared/types/paginated_result.dart';
import '../../use_cases/service_logs/get_service_logs_use_case.dart';
import '../../use_cases/service_logs/create_service_log_use_case.dart';
import '../../use_cases/service_logs/complete_service_log_use_case.dart';
import '../../use_cases/service_logs/get_daily_summary_use_case.dart';

part 'service_logs_event.dart';
part 'service_logs_state.dart';

class ServiceLogsBloc extends Bloc<ServiceLogsEvent, ServiceLogsState> {
  final GetServiceLogsUseCase _getServiceLogs;
  final CreateServiceLogUseCase _createServiceLog;
  final CompleteServiceLogUseCase _completeServiceLog;
  final GetDailySummaryUseCase _getDailySummary;

  String _lastDate = DateFormat('yyyy-MM-dd').format(DateTime.now());

  ServiceLogsBloc({
    required GetServiceLogsUseCase getServiceLogs,
    required CreateServiceLogUseCase createServiceLog,
    required CompleteServiceLogUseCase completeServiceLog,
    required GetDailySummaryUseCase getDailySummary,
  })  : _getServiceLogs = getServiceLogs,
        _createServiceLog = createServiceLog,
        _completeServiceLog = completeServiceLog,
        _getDailySummary = getDailySummary,
        super(const ServiceLogsInitial()) {
    on<LoadServiceLogs>(_onLoad);
    on<CreateServiceLog>(_onCreate);
    on<CompleteServiceLog>(_onComplete);
    on<LoadSummary>(_onLoadSummary);
  }

  Future<void> _onLoad(
      LoadServiceLogs event, Emitter<ServiceLogsState> emit) async {
    emit(const ServiceLogsLoading());
    try {
      _lastDate = event.date ?? _lastDate;
      final results = await Future.wait([
        _getServiceLogs(date: _lastDate, page: event.page),
        _getDailySummary(_lastDate),
      ]);
      emit(ServiceLogsLoaded(
        logs: results[0] as PaginatedResult<ServiceLog>,
        summary: results[1] as DailySummary,
      ));
    } catch (e) {
      emit(ServiceLogsError(e.toString()));
    }
  }

  Future<void> _onCreate(
      CreateServiceLog event, Emitter<ServiceLogsState> emit) async {
    try {
      await _createServiceLog(
        clientResourceId: event.clientResourceId,
        serviceId: event.serviceId,
        attendedBy: event.attendedBy,
        priceCharged: event.priceCharged,
        paymentMethod: event.paymentMethod,
        notes: event.notes,
      );
      add(LoadServiceLogs(date: _lastDate));
    } catch (e) {
      emit(ServiceLogsError(e.toString()));
    }
  }

  Future<void> _onComplete(
      CompleteServiceLog event, Emitter<ServiceLogsState> emit) async {
    try {
      await _completeServiceLog(event.id);
      add(LoadServiceLogs(date: _lastDate));
    } catch (e) {
      emit(ServiceLogsError(e.toString()));
    }
  }

  Future<void> _onLoadSummary(
      LoadSummary event, Emitter<ServiceLogsState> emit) async {
    final currentState = state;
    try {
      final summary = await _getDailySummary(event.date);
      if (currentState is ServiceLogsLoaded) {
        emit(ServiceLogsLoaded(logs: currentState.logs, summary: summary));
      }
    } catch (e) {
      emit(ServiceLogsError(e.toString()));
    }
  }
}
