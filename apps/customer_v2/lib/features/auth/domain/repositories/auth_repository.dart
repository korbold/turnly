// lib/features/auth/domain/repositories/auth_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/user.dart';

abstract class AuthRepository {
  Future<Either<Failure, ({User user, String token})>> login(String email, String password);
  Future<Either<Failure, ({User user, String token})>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  });
  Future<Either<Failure, User>> getMe();
  Future<Either<Failure, Unit>> logout();
  Future<bool> isAuthenticated();
  Future<Either<Failure, ({User user, String token})>> loginWithGoogle();
  Future<Either<Failure, Unit>> verifyEmail({required String email, required String code});
  Future<Either<Failure, Unit>> resendVerification({required String email});

  /// Send a Firebase magic link to the email. Returns Unit on success;
  /// the user finishes the flow by tapping the link, which deep-links
  /// back into the app and triggers [signInWithEmailLink].
  Future<Either<Failure, Unit>> sendMagicLink(String email);

  /// Complete sign-in with the link the user tapped from their email
  /// (deep-linked into the app). Returns the auth tuple just like the
  /// password login path.
  Future<Either<Failure, ({User user, String token})>> signInWithEmailLink({
    required String email,
    required String link,
  });
}
