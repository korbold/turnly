// lib/main.dart
import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app/deep_link_handler.dart';
import 'app/router.dart';
import 'app/theme/app_theme.dart';
import 'core/di/injection.dart';
import 'features/auth/domain/repositories/auth_repository.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
import 'features/favorites/data/favorites_storage.dart';
import 'features/favorites/presentation/cubit/favorites_cubit.dart';
import 'features/reservations/domain/repositories/reservation_repository.dart';
import 'features/reservations/presentation/cubit/reservations_cubit.dart';

/// Default entry point. Kept for backward compat with tooling that ignores
/// `--target`. Reads ENV from --dart-define, defaults to dev.
void main() async {
  const env = String.fromEnvironment('ENV', defaultValue: 'dev');
  await bootstrap(env: env);
}

/// Boots the app for a given environment. Called by main_dev.dart /
/// main_prod.dart with hardcoded env so Firebase config + API URL never
/// cross over between dev and prod.
Future<void> bootstrap({required String env}) async {
  WidgetsFlutterBinding.ensureInitialized();

  await dotenv.load(fileName: '.env.$env');

  // Lock to portrait
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  // Init Firebase. Per-flavor google-services.json (Android) and
  // GoogleService-Info.plist (iOS) carry the right project for this env.
  await Firebase.initializeApp();

  // Init Hive for local storage (favorites, etc.)
  await Hive.initFlutter();

  // Init favorites storage
  final favoritesStorage = FavoritesStorage();
  await favoritesStorage.init();

  // Init Spanish date formatting
  await initializeDateFormatting('es');

  // Configure DI
  configureDependencies();

  // Register FavoritesStorage singleton in DI
  getIt.registerSingleton<FavoritesStorage>(favoritesStorage);

  // Start deep link handler (Android App Links). Safe to call before runApp;
  // it queues incoming links until the router has a navigator context.
  unawaited(DeepLinkHandler.instance.start());

  runApp(TurnlyApp(favoritesStorage: favoritesStorage));
}

class TurnlyApp extends StatelessWidget {
  final FavoritesStorage favoritesStorage;

  const TurnlyApp({super.key, required this.favoritesStorage});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthCubit>(
          create: (_) =>
              AuthCubit(getIt<AuthRepository>())..checkAuth(),
        ),
        BlocProvider<FavoritesCubit>(
          create: (_) => FavoritesCubit(favoritesStorage)..loadAll(),
        ),
        BlocProvider<ReservationsCubit>(
          create: (_) => ReservationsCubit(getIt<ReservationRepository>())..loadReservations(),
        ),
      ],
      child: MaterialApp.router(
        title: 'Turnly',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        routerConfig: appRouter,
      ),
    );
  }
}
