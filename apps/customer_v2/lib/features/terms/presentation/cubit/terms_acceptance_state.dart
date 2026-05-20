// lib/features/terms/presentation/cubit/terms_acceptance_state.dart
import 'package:equatable/equatable.dart';

sealed class TermsAcceptanceState extends Equatable {
  const TermsAcceptanceState();

  @override
  List<Object?> get props => [];
}

class TermsAcceptanceIdle extends TermsAcceptanceState {
  const TermsAcceptanceIdle();
}

class TermsAcceptanceLoading extends TermsAcceptanceState {
  const TermsAcceptanceLoading();
}

class TermsAcceptanceSuccess extends TermsAcceptanceState {
  const TermsAcceptanceSuccess();
}

class TermsAcceptanceError extends TermsAcceptanceState {
  final String message;
  const TermsAcceptanceError(this.message);

  @override
  List<Object?> get props => [message];
}
