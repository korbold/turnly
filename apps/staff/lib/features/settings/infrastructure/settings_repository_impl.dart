import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/dio_client.dart';

class SettingsRepositoryImpl {
  final Dio _dio = DioClient.instance;

  Future<Either<Failure, Map<String, dynamic>>> getSettings() async {
    try {
      final response = await _dio.get('/tenant/settings');
      return Right(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar configuración',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  Future<Either<Failure, Map<String, dynamic>>> updateSettings(Map<String, dynamic> settings) async {
    try {
      final response = await _dio.patch('/tenant/settings', data: settings);
      return Right(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al actualizar configuración',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
