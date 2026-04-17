// lib/features/business/presentation/cubit/business_detail_state.dart
import 'package:equatable/equatable.dart';
import '../../../explore/domain/entities/business.dart';

sealed class BusinessDetailState extends Equatable {
  const BusinessDetailState();
  @override
  List<Object?> get props => [];
}

class BusinessDetailInitial extends BusinessDetailState {
  const BusinessDetailInitial();
}

class BusinessDetailLoading extends BusinessDetailState {
  const BusinessDetailLoading();
}

class BusinessDetailLoaded extends BusinessDetailState {
  final Business business;
  const BusinessDetailLoaded(this.business);
  @override
  List<Object?> get props => [business];
}

class BusinessDetailError extends BusinessDetailState {
  final String message;
  const BusinessDetailError(this.message);
  @override
  List<Object?> get props => [message];
}
