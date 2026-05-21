import 'package:customer_v2/core/error/failures.dart';
import 'package:customer_v2/features/auth/domain/entities/user.dart';
import 'package:customer_v2/features/auth/domain/repositories/auth_repository.dart';
import 'package:customer_v2/features/terms/presentation/cubit/terms_acceptance_cubit.dart';
import 'package:customer_v2/features/terms/presentation/screens/terms_acceptance_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';

class _FakeRepo extends AuthRepository {
  bool shouldFail;
  _FakeRepo({this.shouldFail = false});

  @override
  Future<Either<Failure, Unit>> acceptTerms({required String version}) async {
    if (shouldFail) return const Left(ServerFailure('Error de red'));
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
  @override
  Future<Either<Failure, Unit>> requestAccountDeletion() =>
      throw UnimplementedError();
}

Widget _buildScreen({AuthRepository? repo}) => MaterialApp(
      home: MediaQuery(
        // Disable animations so flutter_animate timers settle immediately
        data: const MediaQueryData(disableAnimations: true),
        child: BlocProvider(
          create: (_) => TermsAcceptanceCubit(repo ?? _FakeRepo()),
          child: const TermsAcceptanceBody(),
        ),
      ),
    );

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  group('TermsAcceptanceScreen', () {
    testWidgets('shows title and CTA', (tester) async {
      await tester.pumpWidget(_buildScreen());
      await tester.pumpAndSettle();

      expect(find.text('Antes de continuar'), findsOneWidget);
      expect(find.text('Continuar'), findsOneWidget);
    });

    testWidgets('CTA disabled when checkbox unchecked', (tester) async {
      await tester.pumpWidget(_buildScreen());
      await tester.pumpAndSettle();

      final button = tester.widget<ElevatedButton>(
        find.ancestor(
          of: find.text('Continuar'),
          matching: find.byType(ElevatedButton),
        ),
      );
      expect(button.onPressed, isNull);
    });

    testWidgets('CTA enabled after checking checkbox', (tester) async {
      await tester.pumpWidget(_buildScreen());
      await tester.pumpAndSettle();

      await tester.tap(find.byType(Checkbox));
      await tester.pumpAndSettle();

      final button = tester.widget<ElevatedButton>(
        find.ancestor(
          of: find.text('Continuar'),
          matching: find.byType(ElevatedButton),
        ),
      );
      expect(button.onPressed, isNotNull);
    });

    testWidgets('shows error message on TermsAcceptanceError state', (tester) async {
      await tester.pumpWidget(_buildScreen(repo: _FakeRepo(shouldFail: true)));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(Checkbox));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();

      expect(find.text('No se pudo registrar tu aceptación. Intenta de nuevo.'), findsOneWidget);
    });
  });
}
