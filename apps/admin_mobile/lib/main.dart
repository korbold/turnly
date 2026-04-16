import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'injection.dart';
import 'presentation/app/router.dart';
import 'presentation/app/theme.dart';
import 'application/blocs/auth/auth_bloc.dart';
import 'application/blocs/settings/settings_bloc.dart';
import 'application/blocs/super_admin/super_admin_bloc.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await configureDependencies();
  runApp(const TurnlyApp());
}

class TurnlyApp extends StatelessWidget {
  const TurnlyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>(
          create: (_) => getIt<AuthBloc>()..add(const CheckAuthRequested()),
        ),
        BlocProvider<SettingsBloc>(
          create: (_) => getIt<SettingsBloc>(),
        ),
        BlocProvider<SuperAdminBloc>(
          create: (_) => getIt<SuperAdminBloc>(),
        ),
      ],
      child: MaterialApp.router(
        title: 'Turnly Admin',
        theme: AppTheme.light,
        routerConfig: appRouter,
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
