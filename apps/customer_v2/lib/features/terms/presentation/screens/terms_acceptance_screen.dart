// lib/features/terms/presentation/screens/terms_acceptance_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/push/push_notification_service.dart';
import '../../../../features/auth/domain/repositories/auth_repository.dart';
import '../../../../features/legal/presentation/screens/legal_screen.dart';
import '../../../../shared/widgets/app_button.dart';
import '../cubit/terms_acceptance_cubit.dart';
import '../cubit/terms_acceptance_state.dart';

class TermsAcceptanceScreen extends StatelessWidget {
  const TermsAcceptanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => TermsAcceptanceCubit(getIt<AuthRepository>()),
      child: const TermsAcceptanceBody(),
    );
  }
}

/// Exported for widget testing — inject a fake cubit via BlocProvider.
class TermsAcceptanceBody extends StatefulWidget {
  const TermsAcceptanceBody({super.key});

  @override
  State<TermsAcceptanceBody> createState() => _TermsAcceptanceBodyState();
}

class _TermsAcceptanceBodyState extends State<TermsAcceptanceBody> {
  bool _checked = false;

  void _openLegal(BuildContext context, LegalType type) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SizedBox(
        height: MediaQuery.of(context).size.height * 0.9,
        child: LegalScreen(type: type),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final reducedMotion = MediaQuery.of(context).disableAnimations;
    final baseDelay = reducedMotion ? Duration.zero : 320.ms;
    const stagger = Duration(milliseconds: 40);
    const contentDuration = Duration(milliseconds: 280);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: BlocConsumer<TermsAcceptanceCubit, TermsAcceptanceState>(
        listener: (context, state) {
          if (state is TermsAcceptanceSuccess) {
            getIt<PushNotificationService>().init();
            context.go('/home');
          }
        },
        builder: (context, state) {
          final isLoading = state is TermsAcceptanceLoading;
          final hasError = state is TermsAcceptanceError;

          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.12),

                  // Icon
                  Container(
                    width: 72,
                    height: 72,
                    decoration: const BoxDecoration(
                      color: AppColors.accentLight,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.verified_user_outlined,
                      color: AppColors.accent,
                      size: 32,
                    ),
                  )
                      .animate(delay: baseDelay)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.04,
                        end: 0,
                        duration: contentDuration,
                        curve: Curves.easeOut,
                      ),

                  const SizedBox(height: 20),

                  // Title
                  Text(
                    'Antes de continuar',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                    textAlign: TextAlign.center,
                  )
                      .animate(delay: baseDelay + stagger)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.04,
                        end: 0,
                        duration: contentDuration,
                        curve: Curves.easeOut,
                      ),

                  const SizedBox(height: 8),

                  // Subtitle
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 260),
                    child: Text(
                      'Tómate un momento para revisar los términos antes de usar Turnly.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                      textAlign: TextAlign.center,
                    ),
                  )
                      .animate(delay: baseDelay + stagger * 2)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.04,
                        end: 0,
                        duration: contentDuration,
                        curve: Curves.easeOut,
                      ),

                  const SizedBox(height: 32),

                  // Legal links card
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      children: [
                        _LegalTile(
                          title: 'Términos y Condiciones',
                          version: 'Versión 1.0',
                          onTap: () => _openLegal(context, LegalType.terms),
                        ),
                        const Divider(height: 1, color: AppColors.border),
                        _LegalTile(
                          title: 'Política de Privacidad',
                          version: 'Versión 1.0',
                          onTap: () => _openLegal(context, LegalType.privacy),
                        ),
                      ],
                    ),
                  )
                      .animate(delay: baseDelay + stagger * 3)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.04,
                        end: 0,
                        duration: contentDuration,
                        curve: Curves.easeOut,
                      ),

                  const SizedBox(height: 24),

                  // Checkbox row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(
                        label:
                            'Acepto los Términos y Condiciones y Política de Privacidad',
                        child: SizedBox(
                          width: 44,
                          height: 44,
                          child: Checkbox(
                            value: _checked,
                            activeColor: AppColors.accent,
                            onChanged: isLoading
                                ? null
                                : (v) =>
                                    setState(() => _checked = v ?? false),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                            'He leído y acepto los Términos y Condiciones y la Política de Privacidad',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: AppColors.textSecondary,
                                    ),
                          ),
                        ),
                      ),
                    ],
                  )
                      .animate(delay: baseDelay + stagger * 4)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut),

                  const Spacer(),

                  // Error message
                  if (hasError)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Semantics(
                        liveRegion: true,
                        child: Text(
                          'No se pudo registrar tu aceptación. Intenta de nuevo.',
                          style: const TextStyle(
                            color: AppColors.error,
                            fontSize: 13,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),

                  // CTA
                  Semantics(
                    label: _checked
                        ? 'Continuar'
                        : 'Continuar, deshabilitado hasta aceptar los términos',
                    excludeSemantics: true,
                    child: AppButton(
                      label: 'Continuar',
                      isLoading: isLoading,
                      onPressed: (_checked && !isLoading)
                          ? () => context.read<TermsAcceptanceCubit>().accept()
                          : null,
                    ),
                  )
                      .animate(delay: baseDelay + stagger * 5)
                      .fadeIn(duration: contentDuration, curve: Curves.easeOut),

                  const SizedBox(height: 24),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LegalTile extends StatelessWidget {
  final String title;
  final String version;
  final VoidCallback onTap;

  const _LegalTile({
    required this.title,
    required this.version,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: AppColors.textPrimary,
        ),
      ),
      subtitle: Text(
        version,
        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
      ),
      trailing: const Icon(
        Icons.chevron_right,
        color: AppColors.textTertiary,
        size: 20,
      ),
      onTap: onTap,
    );
  }
}
