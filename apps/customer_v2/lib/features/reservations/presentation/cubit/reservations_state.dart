// lib/features/reservations/presentation/cubit/reservations_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/reservation.dart';

sealed class ReservationsState extends Equatable {
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
  final List<Reservation> reservations;
  const ReservationsLoaded(this.reservations);
  @override
  List<Object?> get props => [reservations];
}

class ReservationsError extends ReservationsState {
  final String message;
  const ReservationsError(this.message);
  @override
  List<Object?> get props => [message];
}
