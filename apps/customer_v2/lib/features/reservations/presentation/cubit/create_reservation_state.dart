// lib/features/reservations/presentation/cubit/create_reservation_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/available_slot.dart';
import '../../domain/entities/reservation.dart';

sealed class CreateReservationState extends Equatable {
  const CreateReservationState();
  @override
  List<Object?> get props => [];
}

class CreateReservationInitial extends CreateReservationState {
  /// Bumped on every cart mutation so the BlocBuilder reliably
  /// rebuilds even when the high-level state class doesn't change.
  /// Equatable would otherwise treat two `Initial` instances as equal
  /// and the cubit's `emit` would no-op.
  final int version;
  const CreateReservationInitial({this.version = 0});

  @override
  List<Object?> get props => [version];
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
