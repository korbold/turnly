class ClientResource {
  final String id;
  final String label;
  final Map<String, dynamic>? data;

  const ClientResource({
    required this.id,
    required this.label,
    this.data,
  });
}
