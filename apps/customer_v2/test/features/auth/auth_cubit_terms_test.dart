import 'package:customer_v2/core/error/failures.dart';
import 'package:customer_v2/features/auth/domain/entities/user.dart';
import 'package:customer_v2/features/auth/domain/repositories/auth_repository.dart';
import 'package:customer_v2/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:customer_v2/features/auth/presentation/cubit/auth_state.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';

class _FakeAuthRepository extends AuthRepository {
  final User userToReturn;
  _FakeAuthRepository(this.userToReturn);

  @override
  Future<Either<Failure, ({User user, String token})>> loginWithGoogle() async =>
      Right((user: userToReturn, token: 'tok'));

  @override
  Future<Either<Failure, ({User user, String token})>> signInWithEmailLink({
    required String email,
    required String link,
  }) async =>
      Right((user: userToReturn, token: 'tok'));

  @override
  Future<Either<Failure, ({User user, String token})>> login(String e, String p) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, ({User user, String token})>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  }) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, User>> getMe() => throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> logout() => throw UnimplementedError();
  @override
  Future<bool> isAuthenticated() => throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> verifyEmail({
    required String email,
    required String code,
  }) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> resendVerification({required String email}) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, String?>> sendMagicLink(String email) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> acceptTerms({required String version}) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, Unit>> requestAccountDeletion() =>
      throw UnimplementedError();
}

/// No-op push init — avoids FirebaseMessaging/platform calls in unit tests.
Future<void> _noOpPush() async {}

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('AuthCubit — terms pending', () {
    test('loginWithGoogle emits AuthTermsPending when termsAcceptedAt is null', () async {
      const user = User(
        id: '1',
        name: 'Ana',
        email: 'ana@test.com',
        emailVerified: true,
      );
      final cubit = AuthCubit(_FakeAuthRepository(user), initPush: _noOpPush);
      await cubit.loginWithGoogle();
      expect(cubit.state, isA<AuthTermsPending>());
    });

    test('loginWithGoogle emits AuthAuthenticated when terms already accepted', () async {
      final user = User(
        id: '1',
        name: 'Ana',
        email: 'ana@test.com',
        emailVerified: true,
        termsAcceptedAt: DateTime(2026, 1, 1),
      );
      final cubit = AuthCubit(_FakeAuthRepository(user), initPush: _noOpPush);
      await cubit.loginWithGoogle();
      expect(cubit.state, isA<AuthAuthenticated>());
    });

    test('signInWithEmailLink emits AuthTermsPending when termsAcceptedAt is null', () async {
      const user = User(
        id: '1',
        name: 'Ana',
        email: 'ana@test.com',
        emailVerified: true,
      );
      final cubit = AuthCubit(_FakeAuthRepository(user), initPush: _noOpPush);
      await cubit.signInWithEmailLink(
        email: 'ana@test.com',
        link: 'https://dev.goturnly.com/m/${'a' * 64}',
      );
      expect(cubit.state, isA<AuthTermsPending>());
    });
  });
}
