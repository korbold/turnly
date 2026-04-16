import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/entities/reservation.dart';
import '../../../shared/types/paginated_result.dart';
import '../../use_cases/reservations/get_reservations_use_case.dart';
import '../../use_cases/reservations/transition_reservation_use_case.dart';
import '../../use_cases/reservations/cancel_reservation_use_case.dart';

part 'reservations_event.dart';
part 'reservations_state.dart';

class ReservationsBloc extends Bloc<ReservationsEvent, ReservationsState> {
  final GetReservationsUseCase _getReservations;
  final TransitionReservationUseCase _transitionReservation;
  final CancelReservationUseCase _cancelReservation;

  ReservationFilters _lastFilters = const ReservationFilters();

  ReservationsBloc({
    required GetReservationsUseCase getReservations,
    required TransitionReservationUseCase transitionReservation,
    required CancelReservationUseCase cancelReservation,
  })  : _getReservations = getReservations,
        _transitionReservation = transitionReservation,
        _cancelReservation = cancelReservation,
        super(const ReservationsInitial()) {
    on<LoadReservations>(_onLoad);
    on<TransitionReservation>(_onTransition);
    on<CancelReservation>(_onCancel);
  }

  Future<void> _onLoad(
      LoadReservations event, Emitter<ReservationsState> emit) async {
    emit(const ReservationsLoading());
    try {
      _lastFilters = event.filters;
      final result = await _getReservations(event.filters);
      emit(ReservationsLoaded(result));
    } catch (e) {
      emit(ReservationsError(e.toString()));
    }
  }

  Future<void> _onTransition(
      TransitionReservation event, Emitter<ReservationsState> emit) async {
    try {
      await _transitionReservation(event.id, event.action);
      add(LoadReservations(_lastFilters));
    } catch (e) {
      emit(ReservationsError(e.toString()));
    }
  }

  Future<void> _onCancel(
      CancelReservation event, Emitter<ReservationsState> emit) async {
    try {
      await _cancelReservation(event.id, event.reason);
      add(LoadReservations(_lastFilters));
    } catch (e) {
      emit(ReservationsError(e.toString()));
    }
  }
}
