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

  const ExploreLoaded({
    required this.businesses,
    this.activeFilter,
    this.searchQuery = '',
  });

  List<Business> get filtered {
    var result = businesses;
    if (searchQuery.isNotEmpty) {
      final q = searchQuery.toLowerCase();
      result = result.where((b) => b.name.toLowerCase().contains(q)).toList();
    }
    return result;
  }

  @override
  List<Object?> get props => [businesses, activeFilter, searchQuery];
}

class ExploreError extends ExploreState {
  final String message;
  const ExploreError(this.message);
  @override
  List<Object?> get props => [message];
}
