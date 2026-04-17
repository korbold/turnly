// lib/features/reservations/presentation/screens/create_reservation_screen.dart
import 'package:flutter/material.dart';

class CreateReservationScreen extends StatelessWidget {
  final String tenantSlug;
  final String? serviceId;

  const CreateReservationScreen({
    super.key,
    required this.tenantSlug,
    this.serviceId,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text('Create Reservation: $tenantSlug')),
    );
  }
}
