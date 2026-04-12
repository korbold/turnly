class WashHistoryEntry {
  final String id;
  final String serviceName;
  final DateTime startedAt;
  final DateTime? finishedAt;
  final double priceCharged;
  final String paymentMethod;
  final String status;

  const WashHistoryEntry({
    required this.id,
    required this.serviceName,
    required this.startedAt,
    this.finishedAt,
    required this.priceCharged,
    required this.paymentMethod,
    required this.status,
  });
}
