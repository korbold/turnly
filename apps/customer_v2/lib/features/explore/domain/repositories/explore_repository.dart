// lib/features/explore/domain/repositories/explore_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/business.dart';
import '../entities/business_category.dart';

class PaginatedResult<T> {
  final List<T> items;
  final int currentPage;
  final int lastPage;

  const PaginatedResult({
    required this.items,
    required this.currentPage,
    required this.lastPage,
  });

  bool get hasMore => currentPage < lastPage;
}

abstract class ExploreRepository {
  Future<Either<Failure, PaginatedResult<Business>>> getBusinesses({
    String? type,
    int page = 1,
  });
  Future<Either<Failure, Business>> getBusinessBySlug(String slug);
  Future<Either<Failure, List<BusinessCategory>>> getCategories();
}
