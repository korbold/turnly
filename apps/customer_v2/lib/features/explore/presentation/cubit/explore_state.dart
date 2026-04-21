// lib/features/explore/presentation/cubit/explore_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/business.dart';

sealed class ExploreState extends Equatable {
  const ExploreState();
  @override
  List<Object?> get props => [];
}

class ExploreInitial extends ExploreState {
  const ExploreInitial();
}

class ExploreLoading extends ExploreState {
  const ExploreLoading();
}

class ExploreLoaded extends ExploreState {
  final List<Business> businesses;
  final String? activeFilter;
  final String searchQuery;
  final int currentPage;
  final int lastPage;
  final bool loadingMore;

  const ExploreLoaded({
    required this.businesses,
    this.activeFilter,
    this.searchQuery = '',
    this.currentPage = 1,
    this.lastPage = 1,
    this.loadingMore = false,
  });

  bool get hasMore => currentPage < lastPage;

  List<Business> get filtered {
    var result = businesses;
    if (searchQuery.isNotEmpty) {
      final q = searchQuery.toLowerCase();
      result = result.where((b) => b.name.toLowerCase().contains(q)).toList();
    }
    return result;
  }

  ExploreLoaded copyWith({
    List<Business>? businesses,
    String? activeFilter,
    String? searchQuery,
    int? currentPage,
    int? lastPage,
    bool? loadingMore,
  }) {
    return ExploreLoaded(
      businesses: businesses ?? this.businesses,
      activeFilter: activeFilter ?? this.activeFilter,
      searchQuery: searchQuery ?? this.searchQuery,
      currentPage: currentPage ?? this.currentPage,
      lastPage: lastPage ?? this.lastPage,
      loadingMore: loadingMore ?? this.loadingMore,
    );
  }

  @override
  List<Object?> get props =>
      [businesses, activeFilter, searchQuery, currentPage, lastPage, loadingMore];
}

class ExploreError extends ExploreState {
  final String message;
  const ExploreError(this.message);
  @override
  List<Object?> get props => [message];
}
