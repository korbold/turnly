import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/dio_client.dart';
import '../domain/entities/daily_report.dart';
import '../domain/repositories/i_dashboard_repository.dart';

class DashboardRepositoryImpl implements IDashboardRepository {
  final Dio _dio = DioClient.instance;

  @override
  Future<Either<Failure, DailyReport>> getDailyReport(String date) async {
    try {
      final response = await _dio.get('/reports/daily', queryParameters: {'date': date});
      final data = response.data['data'] as Map<String, dynamic>;

      final washes = data['washes'] as Map<String, dynamic>;
      final reservations = data['reservations'] as Map<String, dynamic>;
      final byPayment = washes['by_payment_method'] as Map<String, dynamic>? ?? {};

      return Right(DailyReport(
        totalWashes: (washes['total'] as num?)?.toInt() ?? 0,
        completedWashes: (washes['completed'] as num?)?.toInt() ?? 0,
        inProgressWashes: (washes['in_progress'] as num?)?.toInt() ?? 0,
        revenue: (washes['revenue'] as num?)?.toDouble() ?? 0.0,
        revenueByPayment: {
          'cash': (byPayment['cash'] as num?)?.toDouble() ?? 0.0,
          'card': (byPayment['card'] as num?)?.toDouble() ?? 0.0,
          'transfer': (byPayment['transfer'] as num?)?.toDouble() ?? 0.0,
        },
        totalReservations: (reservations['total'] as num?)?.toInt() ?? 0,
        pendingReservations: (reservations['pending'] as num?)?.toInt() ?? 0,
        confirmedReservations: (reservations['confirmed'] as num?)?.toInt() ?? 0,
      ));
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar reporte diario',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
