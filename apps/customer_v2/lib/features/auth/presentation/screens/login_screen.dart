// lib/features/auth/presentation/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../cubit/auth_cubit.dart';
import '../cubit/auth_state.dart';
import '../widgets/google_sign_in_button.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const _LoginView();
  }
}

class _LoginView extends StatefulWidget {
  const _LoginView();

  @override
  State<_LoginView> createState() => _LoginViewState();
}

class _LoginViewState extends State<_LoginView> {
  final _emailController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  // Single source of truth for the regex; matches the validator.
  static final _emailRegex = RegExp(r'^[\w\.\-+]+@[\w\-]+(\.[\w\-]+)+$');
  bool _emailValid = false;

  @override
  void initState() {
    super.initState();
    _emailController.addListener(_onEmailChanged);
  }

  void _onEmailChanged() {
    final next = _emailRegex.hasMatch(_emailController.text.trim());
    if (next != _emailValid) {
      setState(() => _emailValid = next);
    }
  }

  @override
  void dispose() {
    _emailController.removeListener(_onEmailChanged);
    _emailController.dispose();
    super.dispose();
  }

  void _sendMagicLink() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<AuthCubit>().sendMagicLink(_emailController.text.trim());
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: BlocConsumer<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is AuthAuthenticated) {
            context.go('/home');
          } else if (state is AuthEmailUnverified) {
            context.go('/verify-email?email=${Uri.encodeComponent(state.email)}');
          }
        },
        builder: (context, state) {
          final isLoading = state is AuthLoading;
          final errorMessage = state is AuthError ? state.message : null;
          final magicLinkEmail =
              state is AuthMagicLinkSent ? state.email : null;

          return Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFFF8FAFC), // slate-50
                  Color(0xFFEEF2FF), // indigo-50
                ],
              ),
            ),
            child: SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 40),

                        // Logo
                        Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            color: AppColors.accent,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color:
                                    AppColors.accent.withValues(alpha: 0.3),
                                blurRadius: 24,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: const Center(
                            child: Text(
                              'T',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 32,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        )
                            .animate()
                            .fadeIn(duration: 600.ms)
                            .scale(
                              begin: const Offset(0.8, 0.8),
                              end: const Offset(1.0, 1.0),
                              duration: 600.ms,
                              curve: Curves.easeOutBack,
                            ),

                        const SizedBox(height: 28),

                        // Title — brand identity is already carried by the
                        // avatar above and the brand name in this heading;
                        // no need for a separate "Turnly" wordmark.
                        Text(
                          'Entra a Turnly',
                          style: theme.textTheme.headlineMedium,
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 200.ms)
                            .slideY(
                              begin: 0.12,
                              end: 0,
                              duration: 500.ms,
                              delay: 200.ms,
                            ),

                        const SizedBox(height: 28),

                        // Error
                        if (errorMessage != null)
                          Container(
                            width: double.infinity,
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.error.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color:
                                    AppColors.error.withValues(alpha: 0.2),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.error_outline_rounded,
                                  color: AppColors.error,
                                  size: 20,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    errorMessage,
                                    style: TextStyle(
                                      color: AppColors.error,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ).animate().fadeIn(duration: 300.ms).shakeX(
                                hz: 3,
                                amount: 4,
                                duration: 400.ms,
                              ),

                        // Google Sign-In (primary)
                        GoogleSignInButton(
                          isLoading: state is AuthLoading,
                          onPressed: () {
                            context.read<AuthCubit>().loginWithGoogle();
                          },
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 320.ms)
                            .slideY(
                              begin: 0.1,
                              end: 0,
                              duration: 500.ms,
                              delay: 320.ms,
                            ),

                        const SizedBox(height: 20),

                        // Divider — "or"
                        Row(
                          children: [
                            Expanded(child: Divider(color: Colors.grey.shade300)),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                                'o',
                                style: TextStyle(
                                  color: Colors.grey.shade500,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            Expanded(child: Divider(color: Colors.grey.shade300)),
                          ],
                        ),

                        const SizedBox(height: 20),

                        // Email field
                        AppTextField(
                          label: 'Correo electrónico',
                          hint: 'tu@email.com',
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          prefixIcon:
                              const Icon(Icons.email_outlined, size: 20),
                          validator: (value) {
                            final v = value?.trim() ?? '';
                            if (v.isEmpty) return 'Ingresa tu correo';
                            if (!_emailRegex.hasMatch(v)) {
                              return 'Correo inválido';
                            }
                            return null;
                          },
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 400.ms)
                            .slideY(
                              begin: 0.1,
                              end: 0,
                              duration: 500.ms,
                              delay: 400.ms,
                            ),

                        const SizedBox(height: 24),

                        // Magic-link confirmation banner
                        if (magicLinkEmail != null)
                          Container(
                            width: double.infinity,
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 14,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.accent.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color:
                                    AppColors.accent.withValues(alpha: 0.25),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.mark_email_read_outlined,
                                  color: AppColors.accent,
                                  size: 22,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Te enviamos un link',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 13.5,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Abre el correo en $magicLinkEmail y toca el link para entrar.',
                                        style: TextStyle(
                                          color: AppColors.textSecondary,
                                          fontSize: 12.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ).animate().fadeIn(duration: 300.ms),

                        // Primary CTA: send magic link. Disabled until the
                        // email is well-formed so the tap does not bounce
                        // the user back with an inline error.
                        AppButton(
                          label: 'Enviarme link al email',
                          isLoading: isLoading,
                          onPressed: _emailValid ? _sendMagicLink : null,
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 450.ms)
                            .slideY(
                              begin: 0.1,
                              end: 0,
                              duration: 500.ms,
                              delay: 450.ms,
                            ),

                        const SizedBox(height: 8),

                        Text(
                          'Sin contraseñas. Te mandamos un link y entras con un toque.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textTertiary,
                          ),
                        ).animate().fadeIn(duration: 500.ms, delay: 480.ms),

                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
