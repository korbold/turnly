// lib/features/shared/presentation/screens/not_found_screen.dart
//
// Branded fallback shown by go_router when a deep link can't be resolved
// (e.g. a slug that no longer exists, a typo, or a tampered URL). Sits in
// place of go_router's default debug-style "Page Not Found" screen.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_button.dart';

class NotFoundScreen extends StatelessWidget {
  final Uri? attemptedUri;

  const NotFoundScreen({super.key, this.attemptedUri});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final attempted = attemptedUri?.toString();

    // System back from a deep-link cold-start has no parent route. Send
    // the user to /home instead of letting the navigator pop into a
    // black void.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (context.canPop()) {
          context.pop();
        } else {
          context.go('/home');
        }
      },
      child: Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFFF8FAFC),
              Color(0xFFEEF2FF),
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Brand mark — same artwork as login, slightly smaller
                  // so it reads as a header element rather than the hero.
                  DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.accent.withValues(alpha: 0.18),
                          blurRadius: 24,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Image.asset(
                        'assets/icon/turnly-customer-1024.png',
                        width: 56,
                        height: 56,
                        fit: BoxFit.cover,
                        filterQuality: FilterQuality.medium,
                      ),
                    ),
                  )
                      .animate()
                      .fadeIn(duration: 400.ms)
                      .scale(
                        begin: const Offset(0.95, 0.95),
                        end: const Offset(1, 1),
                        duration: 400.ms,
                        curve: Curves.easeOutCubic,
                      ),

                  const SizedBox(height: 28),

                  Text(
                    'No encontramos esta página',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  )
                      .animate()
                      .fadeIn(duration: 400.ms, delay: 120.ms)
                      .slideY(
                        begin: 0.08,
                        end: 0,
                        duration: 400.ms,
                        delay: 120.ms,
                        curve: Curves.easeOutCubic,
                      ),

                  const SizedBox(height: 8),

                  Text(
                    'El link puede haber expirado o el negocio cambió de nombre.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.45,
                    ),
                  ).animate().fadeIn(duration: 400.ms, delay: 180.ms),

                  if (attempted != null && attempted.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        attempted,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: AppColors.textTertiary,
                        ),
                      ),
                    ).animate().fadeIn(duration: 400.ms, delay: 240.ms),
                  ],

                  const SizedBox(height: 32),

                  AppButton(
                    label: 'Volver al inicio',
                    onPressed: () {
                      HapticFeedback.lightImpact();
                      context.go('/home');
                    },
                  )
                      .animate()
                      .fadeIn(duration: 400.ms, delay: 300.ms)
                      .slideY(
                        begin: 0.08,
                        end: 0,
                        duration: 400.ms,
                        delay: 300.ms,
                        curve: Curves.easeOutCubic,
                      ),
                ],
              ),
            ),
          ),
        ),
      ),
      ),
    );
  }
}
