import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/user.dart';

abstract class IAuthRepository {
  Future<Either<Failure, ({User user, String token})>> login(String email, String password);
  Future<Either<Failure, ({User user, String token})>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  });
  Future<Either<Failure, Unit>> logout();
  Future<bool> isAuthenticated();
}
