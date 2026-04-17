// lib/features/reservations/presentation/screens/reservation_detail_screen.dart
import 'package:flutter/material.dart';

class ReservationDetailScreen extends StatelessWidget {
  final String reservationId;

  const ReservationDetailScreen({super.key, required this.reservationId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text('Reservation Detail: $reservationId')),
    );
  }
}
