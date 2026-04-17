// lib/features/reservations/presentation/cubit/create_reservation_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/available_slot.dart';
import '../../domain/entities/reservation.dart';
import '../../../resources/domain/entities/client_resource.dart';

sealed class CreateReservationState extends Equatable {
  const CreateReservationState();
  @override
  List<Object?> get props => [];
}

class CreateReservationInitial extends CreateReservationState {
  const CreateReservationInitial();
}

class CreateReservationLoadingSlots extends CreateReservationState {
  const CreateReservationLoadingSlots();
}

class CreateReservationSlotsLoaded extends CreateReservationState {
  final List<AvailableSlot> slots;
  const CreateReservationSlotsLoaded(this.slots);
  @override
  List<Object?> get props => [slots];
}

class CreateReservationSubmitting extends CreateReservationState {
  const CreateReservationSubmitting();
}

class CreateReservationSuccess extends CreateReservationState {
  final Reservation reservation;
  const CreateReservationSuccess(this.reservation);
  @override
  List<Object?> get props => [reservation];
}

class CreateReservationError extends CreateReservationState {
  final String message;
  const CreateReservationError(this.message);
  @override
  List<Object?> get props => [message];
}
