part of 'reservations_bloc.dart';

abstract class ReservationsEvent extends Equatable {
  const ReservationsEvent();

  @override
  List<Object?> get props => [];
}

class LoadReservations extends ReservationsEvent {
  final ReservationFilters filters;

  const LoadReservations(this.filters);

  @override
  List<Object?> get props => [filters];
}

class TransitionReservation extends ReservationsEvent {
  final int id;
  final ReservationAction action;

  const TransitionReservation({required this.id, required this.action});

  @override
  List<Object?> get props => [id, action];
}

class CancelReservation extends ReservationsEvent {
  final int id;
  final String reason;

  const CancelReservation({required this.id, required this.reason});

  @override
  List<Object?> get props => [id, reason];
}
