// lib/features/favorites/presentation/cubit/favorites_state.dart
import 'package:equatable/equatable.dart';

sealed class FavoritesState extends Equatable {
  const FavoritesState();

  @override
  List<Object?> get props => [];
}

class FavoritesInitial extends FavoritesState {
  const FavoritesInitial();
}

class FavoritesLoaded extends FavoritesState {
  final Set<String> slugs;

  const FavoritesLoaded(this.slugs);

  @override
  List<Object?> get props => [slugs];
}
