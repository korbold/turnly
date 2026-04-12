import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/dio_client.dart';
import '../../../shared/enums/user_role.dart';
import '../domain/entities/team_member.dart';

class TeamRepositoryImpl {
  final Dio _dio = DioClient.instance;

  TeamMember _fromJson(Map<String, dynamic> json) {
    return TeamMember(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      role: UserRole.fromString(json['role'] as String? ?? ''),
    );
  }

  Future<Either<Failure, List<TeamMember>>> getAll() async {
    try {
      final response = await _dio.get('/users', queryParameters: {'per_page': 200});
      final data = response.data['data'] as List<dynamic>;
      return Right(data.map((e) => _fromJson(e as Map<String, dynamic>)).toList());
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar el equipo',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  Future<Either<Failure, Unit>> updateRole(String userId, UserRole role) async {
    try {
      await _dio.patch('/users/$userId/role', data: {'role': role.apiValue});
      return const Right(unit);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al actualizar el rol',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
