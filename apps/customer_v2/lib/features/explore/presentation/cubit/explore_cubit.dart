// lib/features/explore/presentation/cubit/explore_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/explore_repository.dart';
import 'explore_state.dart';

class ExploreCubit extends Cubit<ExploreState> {
  final ExploreRepository _repository;

  ExploreCubit(this._repository) : super(const ExploreInitial());

  Future<void> loadBusinesses({String? type}) async {
    emit(const ExploreLoading());
    final result = await _repository.getBusinesses(type: type);
    result.fold(
      (failure) => emit(ExploreError(failure.message)),
      (businesses) => emit(ExploreLoaded(
        businesses: businesses,
        activeFilter: type,
      )),
    );
  }

  void search(String query) {
    final current = state;
    if (current is ExploreLoaded) {
      emit(ExploreLoaded(
        businesses: current.businesses,
        activeFilter: current.activeFilter,
        searchQuery: query,
      ));
    }
  }

  void filterByType(String? type) {
    loadBusinesses(type: type);
  }
}
