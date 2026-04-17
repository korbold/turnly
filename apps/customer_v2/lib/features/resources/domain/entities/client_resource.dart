// lib/features/resources/domain/entities/client_resource.dart
import 'package:equatable/equatable.dart';

class ClientResource extends Equatable {
  final String id;
  final String label;
  final Map<String, dynamic>? data;

  const ClientResource({
    required this.id,
    required this.label,
    this.data,
  });

  @override
  List<Object?> get props => [id];
}
