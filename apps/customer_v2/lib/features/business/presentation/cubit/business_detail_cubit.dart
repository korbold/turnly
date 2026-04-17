// lib/features/business/presentation/cubit/business_detail_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../explore/domain/repositories/explore_repository.dart';
import 'business_detail_state.dart';

class BusinessDetailCubit extends Cubit<BusinessDetailState> {
  final ExploreRepository _repository;

  BusinessDetailCubit(this._repository) : super(const BusinessDetailInitial());

  Future<void> loadBusiness(String slug) async {
    emit(const BusinessDetailLoading());
    final result = await _repository.getBusinessBySlug(slug);
    result.fold(
      (failure) => emit(BusinessDetailError(failure.message)),
      (business) => emit(BusinessDetailLoaded(business)),
    );
  }
}
