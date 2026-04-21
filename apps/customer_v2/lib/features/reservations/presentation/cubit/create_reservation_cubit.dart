// lib/features/reservations/presentation/cubit/create_reservation_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/reservation_repository.dart';
import 'create_reservation_state.dart';

class CreateReservationCubit extends Cubit<CreateReservationState> {
  final ReservationRepository _repository;

  CreateReservationCubit(this._repository)
      : super(const CreateReservationInitial());

  Future<void> loadSlots(String date, String serviceId) async {
    emit(const CreateReservationLoadingSlots());
    final result = await _repository.getAvailableSlots(date, serviceId);
    result.fold(
      (failure) => emit(CreateReservationError(failure.message)),
      (slots) => emit(CreateReservationSlotsLoaded(slots)),
    );
  }

  Future<void> createReservation({
    String? clientResourceId,
    required String serviceId,
    required String scheduledAt,
    String? notes,
  }) async {
    emit(const CreateReservationSubmitting());
    final result = await _repository.create(
      clientResourceId: clientResourceId ?? '',
      serviceId: serviceId,
      scheduledAt: scheduledAt,
      notes: notes,
    );
    result.fold(
      (failure) => emit(CreateReservationError(failure.message)),
      (reservation) => emit(CreateReservationSuccess(reservation)),
    );
  }
}
