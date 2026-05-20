import 'package:customer_v2/core/error/failures.dart';
import 'package:customer_v2/features/auth/domain/entities/user.dart';
import 'package:customer_v2/features/auth/domain/repositories/auth_repository.dart';
import 'package:customer_v2/features/terms/presentation/cubit/terms_acceptance_cubit.dart';
import 'package:customer_v2/features/terms/presentation/cubit/terms_acceptance_state.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';

class _MockAuthRepository extends AuthRepository {
  Failure? failureToReturn;

  @override
  Future<Either<Failure, Unit>> acceptTerms({required String version}) async {
    if (failureToReturn != null) return Left(failureToReturn!);
    return const Right(unit);
  }

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
  Future<Either<Failure, ({User user, String token})>> loginWithGoogle() =>
      throw UnimplementedError();
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
  Future<Either<Failure, Unit>> sendMagicLink(String email) =>
      throw UnimplementedError();
  @override
  Future<Either<Failure, ({User user, String token})>> signInWithEmailLink({
    required String email,
    required String link,
  }) =>
      throw UnimplementedError();
}

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('TermsAcceptanceCubit', () {
    test('starts in TermsAcceptanceIdle', () {
      final cubit = TermsAcceptanceCubit(_MockAuthRepository());
      expect(cubit.state, isA<TermsAcceptanceIdle>());
    });

    test('accept() emits Loading then Success on success', () async {
      final cubit = TermsAcceptanceCubit(_MockAuthRepository());

      final expectation = expectLater(
        cubit.stream,
        emitsInOrder([
          isA<TermsAcceptanceLoading>(),
          isA<TermsAcceptanceSuccess>(),
        ]),
      );

      await cubit.accept();
      await expectation;
    });

    test('accept() emits Loading then Error on failure', () async {
      final repo = _MockAuthRepository()
        ..failureToReturn = const ServerFailure('red no disponible');
      final cubit = TermsAcceptanceCubit(repo);

      expectLater(
        cubit.stream,
        emitsInOrder([
          isA<TermsAcceptanceLoading>(),
          isA<TermsAcceptanceError>(),
        ]),
      );

      await cubit.accept();

      expect(cubit.state, isA<TermsAcceptanceError>());
      expect((cubit.state as TermsAcceptanceError).message, 'red no disponible');
    });
  });
}
