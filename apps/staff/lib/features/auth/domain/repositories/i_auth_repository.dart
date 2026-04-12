import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/staff_user.dart';

abstract class IAuthRepository {
  Future<Either<Failure, StaffUser>> login(String tenantSlug, String email, String password);
  Future<Either<Failure, Unit>> logout();
  Future<bool> isAuthenticated();
}
