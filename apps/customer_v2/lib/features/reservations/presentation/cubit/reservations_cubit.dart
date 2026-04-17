// lib/features/reservations/presentation/cubit/reservations_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/reservation_repository.dart';
import 'reservations_state.dart';

class ReservationsCubit extends Cubit<ReservationsState> {
  final ReservationRepository _repository;

  ReservationsCubit(this._repository) : super(const ReservationsInitial());

  Future<void> loadReservations({String? status}) async {
    emit(const ReservationsLoading());
    final result = await _repository.getAll(status: status);
    result.fold(
      (failure) => emit(ReservationsError(failure.message)),
      (reservations) => emit(ReservationsLoaded(reservations)),
    );
  }

  Future<bool> cancelReservation(String id, {String? reason}) async {
    final result = await _repository.cancel(id, reason: reason);
    return result.isRight();
  }
}
