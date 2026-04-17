// lib/core/di/injection.dart
import 'package:get_it/get_it.dart';
import 'package:dio/dio.dart';
import '../network/api_client.dart';

final getIt = GetIt.instance;

void configureDependencies() {
  // Network
  getIt.registerLazySingleton<Dio>(() => ApiClient.instance);

  // Repositories will be registered as features are added
}
