class DailySummary {
  final int totalWashes;
  final double totalRevenue;
  final Map<String, PaymentSummary> byPaymentMethod;
  final int inProgress;
  final int completed;

  const DailySummary({
    required this.totalWashes,
    required this.totalRevenue,
    required this.byPaymentMethod,
    required this.inProgress,
    required this.completed,
  });
}

class PaymentSummary {
  final int count;
  final double total;
  const PaymentSummary({required this.count, required this.total});
}
