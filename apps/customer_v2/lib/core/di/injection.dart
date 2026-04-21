// lib/core/di/injection.dart
import 'package:get_it/get_it.dart';
import 'package:dio/dio.dart';
import '../network/api_client.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/explore/domain/repositories/explore_repository.dart';
import '../../features/explore/data/repositories/explore_repository_impl.dart';
import '../../features/reservations/domain/repositories/reservation_repository.dart';
import '../../features/reservations/data/repositories/reservation_repository_impl.dart';
import '../../features/resources/domain/repositories/resource_repository.dart';
import '../../features/resources/data/repositories/resource_repository_impl.dart';
import '../push/push_notification_service.dart';
final getIt = GetIt.instance;

void configureDependencies() {
  // Network
  getIt.registerLazySingleton<Dio>(() => ApiClient.instance);

  // Auth
  getIt.registerLazySingleton<AuthRepository>(() => AuthRepositoryImpl());

  // Explore
  getIt.registerLazySingleton<ExploreRepository>(() => ExploreRepositoryImpl());

  // Reservations
  getIt.registerLazySingleton<ReservationRepository>(() => ReservationRepositoryImpl());

  // Resources
  getIt.registerLazySingleton<ResourceRepository>(() => ResourceRepositoryImpl());

  // Push
  getIt.registerLazySingleton<PushNotificationService>(() => PushNotificationService());
}
