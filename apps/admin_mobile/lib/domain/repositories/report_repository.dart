abstract class ReportRepository {
  Future<Map<String, dynamic>> getDaily(String date);
  Future<Map<String, dynamic>> getRange(String from, String to);
  Future<Map<String, dynamic>> getWeekly(String week);
  Future<Map<String, dynamic>> getMonthly(String month);
}
