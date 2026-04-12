import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/dio_client.dart';

class ReportRepositoryImpl {
  final Dio _dio = DioClient.instance;

  Future<Either<Failure, Map<String, dynamic>>> getDailyReport(String date) async {
    try {
      final response = await _dio.get('/reports/daily', queryParameters: {'date': date});
      return Right(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar reporte diario',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  Future<Either<Failure, Map<String, dynamic>>> getWeeklyReport(String week) async {
    try {
      final response = await _dio.get('/reports/weekly', queryParameters: {'week': week});
      return Right(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar reporte semanal',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  Future<Either<Failure, Map<String, dynamic>>> getMonthlyReport(String month) async {
    try {
      final response = await _dio.get('/reports/monthly', queryParameters: {'month': month});
      return Right(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar reporte mensual',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
