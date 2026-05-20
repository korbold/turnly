// lib/features/terms/presentation/cubit/terms_acceptance_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../auth/domain/repositories/auth_repository.dart';
import 'terms_acceptance_state.dart';

class TermsAcceptanceCubit extends Cubit<TermsAcceptanceState> {
  final AuthRepository _repository;

  TermsAcceptanceCubit(this._repository) : super(const TermsAcceptanceIdle());

  Future<void> accept() async {
    emit(const TermsAcceptanceLoading());
    final result = await _repository.acceptTerms(version: '1.0');
    await result.fold(
      (failure) async => emit(TermsAcceptanceError(failure.message)),
      (_) async {
        await SecureStorage.setTermsAccepted(true);
        emit(const TermsAcceptanceSuccess());
      },
    );
  }
}
