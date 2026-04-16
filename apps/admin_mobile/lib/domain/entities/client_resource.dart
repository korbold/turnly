import 'package:equatable/equatable.dart';

class ClientResource extends Equatable {
  final int id;
  final int tenantId;
  final int clientId;
  final Map<String, dynamic>? data;
  final String? plate;
  final String? brand;
  final String? model;
  final String? color;
  final String? type;
  final DateTime createdAt;
  final String? clientName;
  final String? clientEmail;

  const ClientResource({
    required this.id,
    required this.tenantId,
    required this.clientId,
    this.data,
    this.plate,
    this.brand,
    this.model,
    this.color,
    this.type,
    required this.createdAt,
    this.clientName,
    this.clientEmail,
  });

  @override
  List<Object?> get props => [id];
}
