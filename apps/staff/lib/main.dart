import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

void main() {
  runApp(const ProviderScope(child: WashFlowStaffApp()));
}

class WashFlowStaffApp extends StatelessWidget {
  const WashFlowStaffApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'WashFlow Staff',
      theme: AppTheme.light,
      routerConfig: goRouter,
      debugShowCheckedModeBanner: false,
    );
  }
}
