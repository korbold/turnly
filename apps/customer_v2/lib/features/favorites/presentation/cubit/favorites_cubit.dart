// lib/features/favorites/presentation/cubit/favorites_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../data/favorites_storage.dart';
import 'favorites_state.dart';

class FavoritesCubit extends Cubit<FavoritesState> {
  final FavoritesStorage _storage;

  FavoritesCubit(this._storage) : super(const FavoritesInitial());

  /// Load all favorites from local storage.
  void loadAll() {
    emit(FavoritesLoaded(_storage.getAll()));
  }

  /// Toggle a business slug in/out of favorites.
  void toggle(String slug) {
    _storage.toggle(slug);
    emit(FavoritesLoaded(_storage.getAll()));
  }

  /// Check if a slug is in favorites.
  bool isFavorite(String slug) => _storage.isFavorite(slug);

  /// Clear all favorites (used on logout).
  void clear() {
    _storage.clearAll();
    emit(const FavoritesLoaded({}));
  }
}
