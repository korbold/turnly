// lib/features/explore/presentation/cubit/explore_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/explore_repository.dart';
import 'explore_state.dart';

class ExploreCubit extends Cubit<ExploreState> {
  final ExploreRepository _repository;

  ExploreCubit(this._repository) : super(const ExploreInitial());

  Future<void> loadBusinesses({String? type}) async {
    emit(const ExploreLoading());
    final result = await _repository.getBusinesses(type: type, page: 1);
    result.fold(
      (failure) => emit(ExploreError(failure.message)),
      (paginated) => emit(ExploreLoaded(
        businesses: paginated.items,
        activeFilter: type,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      )),
    );
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! ExploreLoaded || !current.hasMore || current.loadingMore) return;

    emit(current.copyWith(loadingMore: true));

    final result = await _repository.getBusinesses(
      type: current.activeFilter,
      page: current.currentPage + 1,
    );

    result.fold(
      (_) => emit(current.copyWith(loadingMore: false)),
      (paginated) => emit(current.copyWith(
        businesses: [...current.businesses, ...paginated.items],
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
        loadingMore: false,
      )),
    );
  }

  void search(String query) {
    final current = state;
    if (current is ExploreLoaded) {
      emit(current.copyWith(searchQuery: query));
    }
  }

  void filterByType(String? type) {
    loadBusinesses(type: type);
  }
}
