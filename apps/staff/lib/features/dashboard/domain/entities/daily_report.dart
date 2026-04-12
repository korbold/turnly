class DailyReport {
  final int totalWashes;
  final int completedWashes;
  final int inProgressWashes;
  final double revenue;
  final Map<String, double> revenueByPayment;
  final int totalReservations;
  final int pendingReservations;
  final int confirmedReservations;

  const DailyReport({
    required this.totalWashes,
    required this.completedWashes,
    required this.inProgressWashes,
    required this.revenue,
    required this.revenueByPayment,
    required this.totalReservations,
    required this.pendingReservations,
    required this.confirmedReservations,
  });
}
