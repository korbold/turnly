// lib/features/explore/data/repositories/explore_repository_impl.dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/business.dart';
import '../../domain/repositories/explore_repository.dart';
import '../dtos/business_dto.dart';

class ExploreRepositoryImpl implements ExploreRepository {
  final Dio _dio = ApiClient.instance;

  @override
  Future<Either<Failure, List<Business>>> getBusinesses({String? type}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (type != null) queryParams['type'] = type;

      final response = await _dio.get(
        '/public/tenants',
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );

      final data = response.data['data'] as List<dynamic>;
      final businesses = data
          .map((e) => BusinessDto(e as Map<String, dynamic>).toEntity())
          .toList();
      return Right(businesses);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al cargar negocios',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Business>> getBusinessBySlug(String slug) async {
    try {
      final response = await _dio.get('/public/tenants/$slug');
      final business = BusinessDto(
        response.data['data'] as Map<String, dynamic>,
      ).toEntity();
      return Right(business);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        return const Left(NotFoundFailure('Negocio no encontrado'));
      }
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al cargar negocio',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
