// lib/features/favorites/data/favorites_storage.dart
import 'package:hive_flutter/hive_flutter.dart';

class FavoritesStorage {
  static const _boxName = 'favorites';
  late Box<String> _box;

  /// Open the Hive box. Must be called before any other method.
  Future<void> init() async {
    _box = await Hive.openBox<String>(_boxName);
  }

  /// Toggle a slug in/out of favorites. Returns true if now favorited.
  bool toggle(String slug) {
    if (_box.values.contains(slug)) {
      final key = _box.keys.firstWhere(
        (k) => _box.get(k) == slug,
      );
      _box.delete(key);
      return false;
    } else {
      _box.add(slug);
      return true;
    }
  }

  /// Check whether a slug is currently favorited.
  bool isFavorite(String slug) => _box.values.contains(slug);

  /// Return all favorited slugs.
  Set<String> getAll() => _box.values.toSet();

  /// Clear all favorites.
  void clearAll() => _box.clear();
}
