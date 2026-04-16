import '../../../domain/repositories/report_repository.dart';
import '../dio_client.dart';

class ApiReportRepository implements ReportRepository {
  final DioClient _client;

  ApiReportRepository(this._client);

  @override
  Future<Map<String, dynamic>> getDaily(String date) async {
    final response = await _client.dio
        .get('/reports/daily', queryParameters: {'date': date});
    return (response.data['data'] ?? response.data) as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> getRange(String from, String to) async {
    final response = await _client.dio
        .get('/reports/range', queryParameters: {'from': from, 'to': to});
    return (response.data['data'] ?? response.data) as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> getWeekly(String week) async {
    final response = await _client.dio
        .get('/reports/weekly', queryParameters: {'week': week});
    return (response.data['data'] ?? response.data) as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> getMonthly(String month) async {
    final response = await _client.dio
        .get('/reports/monthly', queryParameters: {'month': month});
    return (response.data['data'] ?? response.data) as Map<String, dynamic>;
  }
}
