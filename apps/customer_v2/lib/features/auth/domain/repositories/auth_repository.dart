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

  /// Send a magic link to the email. Returns null on success (normal flow);
  /// returns a non-null token string when the backend issues a demo bypass
  /// (e.g. demo@turnly.app for App Store review) — caller should
  /// immediately invoke [signInWithEmailLink] with that token.
  Future<Either<Failure, String?>> sendMagicLink(String email);

  /// Complete sign-in with the link the user tapped from their email
  /// (deep-linked into the app). Returns the auth tuple just like the
  /// password login path.
  Future<Either<Failure, ({User user, String token})>> signInWithEmailLink({
    required String email,
    required String link,
  });

  Future<Either<Failure, Unit>> acceptTerms({required String version});

  Future<Either<Failure, Unit>> requestAccountDeletion();
}
