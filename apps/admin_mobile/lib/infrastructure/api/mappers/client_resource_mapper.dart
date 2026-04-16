import '../../../domain/entities/client_resource.dart';

ClientResource mapClientResource(Map<String, dynamic> json) {
  return ClientResource(
    id: json['id'] as int,
    tenantId: json['tenant_id'] as int,
    clientId: json['client_id'] as int,
    data: json['data'] as Map<String, dynamic>?,
    plate: json['plate'] as String?,
    brand: json['brand'] as String?,
    model: json['model'] as String?,
    color: json['color'] as String?,
    type: json['type'] as String?,
    createdAt: DateTime.parse(json['created_at'] as String),
    clientName:
        json['client']?['name'] as String? ?? json['client_name'] as String?,
    clientEmail:
        json['client']?['email'] as String? ?? json['client_email'] as String?,
  );
}
