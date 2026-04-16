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

// Use Cases
import 'application/use_cases/auth/login_use_case.dart';
import 'application/use_cases/auth/logout_use_case.dart';
import 'application/use_cases/auth/get_me_use_case.dart';
import 'application/use_cases/auth/register_use_case.dart';
import 'application/use_cases/reservations/get_reservations_use_case.dart';
import 'application/use_cases/reservations/get_reservation_use_case.dart';
import 'application/use_cases/reservations/create_reservation_use_case.dart';
import 'application/use_cases/reservations/transition_reservation_use_case.dart';
import 'application/use_cases/reservations/cancel_reservation_use_case.dart';
import 'application/use_cases/reservations/get_available_slots_use_case.dart';
import 'application/use_cases/services/get_services_use_case.dart';
import 'application/use_cases/services/create_service_use_case.dart';
import 'application/use_cases/services/update_service_use_case.dart';
import 'application/use_cases/services/delete_service_use_case.dart';
import 'application/use_cases/service_logs/get_service_logs_use_case.dart';
import 'application/use_cases/service_logs/create_service_log_use_case.dart';
import 'application/use_cases/service_logs/update_service_log_use_case.dart';
import 'application/use_cases/service_logs/delete_service_log_use_case.dart';
import 'application/use_cases/service_logs/complete_service_log_use_case.dart';
import 'application/use_cases/service_logs/get_daily_summary_use_case.dart';
import 'application/use_cases/clients/get_clients_use_case.dart';
import 'application/use_cases/clients/get_client_use_case.dart';
import 'application/use_cases/clients/create_client_use_case.dart';
import 'application/use_cases/clients/update_client_use_case.dart';
import 'application/use_cases/clients/get_client_history_use_case.dart';
import 'application/use_cases/team/get_team_use_case.dart';
import 'application/use_cases/team/invite_user_use_case.dart';
import 'application/use_cases/team/change_role_use_case.dart';
import 'application/use_cases/reports/get_range_report_use_case.dart';
import 'application/use_cases/reports/get_daily_report_use_case.dart';
import 'application/use_cases/settings/get_settings_use_case.dart';
import 'application/use_cases/settings/update_settings_use_case.dart';

// BLoCs
import 'application/blocs/auth/auth_bloc.dart';
import 'application/blocs/reservations/reservations_bloc.dart';
import 'application/blocs/dashboard/dashboard_bloc.dart';
import 'application/blocs/services/services_bloc.dart';
import 'application/blocs/service_logs/service_logs_bloc.dart';
import 'application/blocs/clients/clients_bloc.dart';
import 'application/blocs/team/team_bloc.dart';
import 'application/blocs/reports/reports_bloc.dart';
import 'application/blocs/settings/settings_bloc.dart';
import 'application/blocs/super_admin/super_admin_bloc.dart';

final getIt = GetIt.instance;

Future<void> configureDependencies() async {
  // ── Storage ──────────────────────────────────────────────────────────
  getIt.registerLazySingleton<SecureStorageService>(
      () => SecureStorageService());

  final preferences = PreferencesService();
  await preferences.init();
  getIt.registerSingleton<PreferencesService>(preferences);

  // ── Networking ───────────────────────────────────────────────────────
  getIt.registerLazySingleton<DioClient>(() => DioClient(
        secureStorage: getIt<SecureStorageService>(),
        preferences: getIt<PreferencesService>(),
      ));

  // ── Services ─────────────────────────────────────────────────────────
  getIt.registerLazySingleton<FirebasePushService>(
      () => FirebasePushService());
  getIt.registerLazySingleton<CameraService>(() => CameraService());

  // ── Repositories ─────────────────────────────────────────────────────
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

  // ── Use Cases: Auth ──────────────────────────────────────────────────
  getIt.registerFactory(() => LoginUseCase(getIt<AuthRepository>()));
  getIt.registerFactory(() => LogoutUseCase(getIt<AuthRepository>()));
  getIt.registerFactory(() => GetMeUseCase(getIt<AuthRepository>()));
  getIt.registerFactory(() => RegisterUseCase(getIt<AuthRepository>()));

  // ── Use Cases: Reservations ──────────────────────────────────────────
  getIt.registerFactory(
      () => GetReservationsUseCase(getIt<ReservationRepository>()));
  getIt.registerFactory(
      () => GetReservationUseCase(getIt<ReservationRepository>()));
  getIt.registerFactory(
      () => CreateReservationUseCase(getIt<ReservationRepository>()));
  getIt.registerFactory(
      () => TransitionReservationUseCase(getIt<ReservationRepository>()));
  getIt.registerFactory(
      () => CancelReservationUseCase(getIt<ReservationRepository>()));
  getIt.registerFactory(
      () => GetAvailableSlotsUseCase(getIt<ReservationRepository>()));

  // ── Use Cases: Services ──────────────────────────────────────────────
  getIt.registerFactory(
      () => GetServicesUseCase(getIt<ServiceRepository>()));
  getIt.registerFactory(
      () => CreateServiceUseCase(getIt<ServiceRepository>()));
  getIt.registerFactory(
      () => UpdateServiceUseCase(getIt<ServiceRepository>()));
  getIt.registerFactory(
      () => DeleteServiceUseCase(getIt<ServiceRepository>()));

  // ── Use Cases: Service Logs ──────────────────────────────────────────
  getIt.registerFactory(
      () => GetServiceLogsUseCase(getIt<ServiceLogRepository>()));
  getIt.registerFactory(
      () => CreateServiceLogUseCase(getIt<ServiceLogRepository>()));
  getIt.registerFactory(
      () => UpdateServiceLogUseCase(getIt<ServiceLogRepository>()));
  getIt.registerFactory(
      () => DeleteServiceLogUseCase(getIt<ServiceLogRepository>()));
  getIt.registerFactory(
      () => CompleteServiceLogUseCase(getIt<ServiceLogRepository>()));
  getIt.registerFactory(
      () => GetDailySummaryUseCase(getIt<ServiceLogRepository>()));

  // ── Use Cases: Clients ───────────────────────────────────────────────
  getIt.registerFactory(
      () => GetClientsUseCase(getIt<ClientResourceRepository>()));
  getIt.registerFactory(
      () => GetClientUseCase(getIt<ClientResourceRepository>()));
  getIt.registerFactory(
      () => CreateClientUseCase(getIt<ClientResourceRepository>()));
  getIt.registerFactory(
      () => UpdateClientUseCase(getIt<ClientResourceRepository>()));
  getIt.registerFactory(
      () => GetClientHistoryUseCase(getIt<ClientResourceRepository>()));

  // ── Use Cases: Team ──────────────────────────────────────────────────
  getIt.registerFactory(() => GetTeamUseCase(getIt<UserRepository>()));
  getIt.registerFactory(() => InviteUserUseCase(getIt<UserRepository>()));
  getIt.registerFactory(() => ChangeRoleUseCase(getIt<UserRepository>()));

  // ── Use Cases: Reports ───────────────────────────────────────────────
  getIt.registerFactory(
      () => GetRangeReportUseCase(getIt<ReportRepository>()));
  getIt.registerFactory(
      () => GetDailyReportUseCase(getIt<ReportRepository>()));

  // ── Use Cases: Settings ──────────────────────────────────────────────
  getIt.registerFactory(
      () => GetSettingsUseCase(getIt<TenantRepository>()));
  getIt.registerFactory(
      () => UpdateSettingsUseCase(getIt<TenantRepository>()));

  // ── BLoCs ────────────────────────────────────────────────────────────
  getIt.registerFactory(() => AuthBloc(
        loginUseCase: getIt<LoginUseCase>(),
        logoutUseCase: getIt<LogoutUseCase>(),
        getMeUseCase: getIt<GetMeUseCase>(),
        registerUseCase: getIt<RegisterUseCase>(),
        storage: getIt<SecureStorageService>(),
      ));

  getIt.registerFactory(() => ReservationsBloc(
        getReservations: getIt<GetReservationsUseCase>(),
        transitionReservation: getIt<TransitionReservationUseCase>(),
        cancelReservation: getIt<CancelReservationUseCase>(),
      ));

  getIt.registerFactory(() => DashboardBloc(
        getServiceLogs: getIt<GetServiceLogsUseCase>(),
        getReservations: getIt<GetReservationsUseCase>(),
        getDailySummary: getIt<GetDailySummaryUseCase>(),
      ));

  getIt.registerFactory(() => ServicesBloc(
        getServices: getIt<GetServicesUseCase>(),
        createService: getIt<CreateServiceUseCase>(),
        updateService: getIt<UpdateServiceUseCase>(),
        deleteService: getIt<DeleteServiceUseCase>(),
      ));

  getIt.registerFactory(() => ServiceLogsBloc(
        getServiceLogs: getIt<GetServiceLogsUseCase>(),
        createServiceLog: getIt<CreateServiceLogUseCase>(),
        completeServiceLog: getIt<CompleteServiceLogUseCase>(),
        getDailySummary: getIt<GetDailySummaryUseCase>(),
      ));

  getIt.registerFactory(() => ClientsBloc(
        getClients: getIt<GetClientsUseCase>(),
        getClient: getIt<GetClientUseCase>(),
        getClientHistory: getIt<GetClientHistoryUseCase>(),
      ));

  getIt.registerFactory(() => TeamBloc(
        getTeam: getIt<GetTeamUseCase>(),
        inviteUser: getIt<InviteUserUseCase>(),
        changeRole: getIt<ChangeRoleUseCase>(),
      ));

  getIt.registerFactory(() => ReportsBloc(
        getRangeReport: getIt<GetRangeReportUseCase>(),
        getDailyReport: getIt<GetDailyReportUseCase>(),
      ));

  getIt.registerFactory(() => SettingsBloc(
        getSettings: getIt<GetSettingsUseCase>(),
        updateSettings: getIt<UpdateSettingsUseCase>(),
      ));

  getIt.registerFactory(
      () => SuperAdminBloc(repository: getIt<SuperAdminRepository>()));
}
