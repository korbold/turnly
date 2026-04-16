part of 'reservations_bloc.dart';

abstract class ReservationsState extends Equatable {
  const ReservationsState();

  @override
  List<Object?> get props => [];
}

class ReservationsInitial extends ReservationsState {
  const ReservationsInitial();
}

class ReservationsLoading extends ReservationsState {
  const ReservationsLoading();
}

class ReservationsLoaded extends ReservationsState {
  final PaginatedResult<Reservation> result;

  const ReservationsLoaded(this.result);

  @override
  List<Object?> get props => [result];
}

class ReservationsError extends ReservationsState {
  final String message;

  const ReservationsError(this.message);

  @override
  List<Object?> get props => [message];
}
