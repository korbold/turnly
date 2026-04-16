import 'package:get_it/get_it.dart';

import 'domain/repositories/auth_repository.dart';
import 'domain/repositories/availability_repository.dart';
import 'domain/repositories/client_resource_repository.dart';
import 'domain/repositories/onboarding_repository.dart';
import 'domain/repositories/report_repository.dart';
import 'domain/repositories/reservation_repository.dart';
import 'domain/repositories/service_log_repository.dart';
import 'domain/repositories/service_repository.dart';
import 'domain/repositories/super_admin_repository.dart';
import 'domain/repositories/tenant_repository.dart';
import 'domain/repositories/upload_repository.dart';
import 'domain/repositories/user_repository.dart';
import 'infrastructure/api/dio_client.dart';
import 'infrastructure/api/repositories/api_auth_repository.dart';
import 'infrastructure/api/repositories/api_availability_repository.dart';
import 'infrastructure/api/repositories/api_client_resource_repository.dart';
import 'infrastructure/api/repositories/api_onboarding_repository.dart';
import 'infrastructure/api/repositories/api_report_repository.dart';
import 'infrastructure/api/repositories/api_reservation_repository.dart';
import 'infrastructure/api/repositories/api_service_log_repository.dart';
import 'infrastructure/api/repositories/api_service_repository.dart';
import 'infrastructure/api/repositories/api_super_admin_repository.dart';
import 'infrastructure/api/repositories/api_tenant_repository.dart';
import 'infrastructure/api/repositories/api_upload_repository.dart';
import 'infrastructure/api/repositories/api_user_repository.dart';
import 'infrastructure/camera/camera_service.dart';
import 'infrastructure/push/firebase_push_service.dart';
import 'infrastructure/storage/preferences.dart';
import 'infrastructure/storage/secure_storage.dart';

final getIt = GetIt.instance;

Future<void> configureDependencies() async {
  // Storage
  getIt.registerLazySingleton<SecureStorageService>(
      () => SecureStorageService());

  final preferences = PreferencesService();
  await preferences.init();
  getIt.registerSingleton<PreferencesService>(preferences);

  // Networking
  getIt.registerLazySingleton<DioClient>(() => DioClient(
        secureStorage: getIt<SecureStorageService>(),
        preferences: getIt<PreferencesService>(),
      ));

  // Services
  getIt.registerLazySingleton<FirebasePushService>(
      () => FirebasePushService());
  getIt.registerLazySingleton<CameraService>(() => CameraService());

  // Repositories
  getIt.registerLazySingleton<AuthRepository>(
      () => ApiAuthRepository(getIt<DioClient>()));
  getIt.registerLazySingleton<OnboardingRepository>(
      () => ApiOnboardingRepository(getIt<DioClient>()));
  getIt.registerLazySingleton<ReservationRepository>(
      () => ApiReservationRepository(getIt<DioClient>()));
  getIt.registerLazySingleton<ServiceRepository>(
      () => ApiServiceRepository(getIt<DioClient>()));
  getIt.registerLazySingleton<ServiceLogRepository>(
      () => ApiServiceLogRepository(getIt<DioClient>()));
  getIt.registerLazySingleton<ClientResourceRepository>(
      () => ApiClientResourceRepository(getIt<DioClient>()));
  getIt.registerLazySingleton<UserRepository>(
      () => ApiUserRepository(getIt<DioClient>()));
  getIt.registerLazySingleton<TenantRepository>(
      () => ApiTenantRepository(getIt<DioClient>()));
  getIt.registerLazySingleton<ReportRepository>(
      () => ApiReportRepository(getIt<DioClient>()));
  getIt.registerLazySingleton<AvailabilityRepository>(
      () => ApiAvailabilityRepository(getIt<DioClient>()));
  getIt.registerLazySingleton<UploadRepository>(
      () => ApiUploadRepository(getIt<DioClient>()));
  getIt.registerLazySingleton<SuperAdminRepository>(
      () => ApiSuperAdminRepository(getIt<DioClient>()));
}
