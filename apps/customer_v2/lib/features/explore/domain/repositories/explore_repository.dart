// lib/features/explore/domain/repositories/explore_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/business.dart';

abstract class ExploreRepository {
  Future<Either<Failure, List<Business>>> getBusinesses({String? type});
  Future<Either<Failure, Business>> getBusinessBySlug(String slug);
}
