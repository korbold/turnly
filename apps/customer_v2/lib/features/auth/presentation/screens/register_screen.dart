// lib/features/auth/presentation/screens/register_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../domain/repositories/auth_repository.dart';
import '../cubit/auth_cubit.dart';
import '../cubit/auth_state.dart';
import '../widgets/google_sign_in_button.dart';

class RegisterScreen extends StatelessWidget {
  const RegisterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => AuthCubit(getIt<AuthRepository>()),
      child: const _RegisterView(),
    );
  }
}

class _RegisterView extends StatefulWidget {
  const _RegisterView();

  @override
  State<_RegisterView> createState() => _RegisterViewState();
}

class _RegisterViewState extends State<_RegisterView> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<AuthCubit>().register(
            name: _nameController.text.trim(),
            email: _emailController.text.trim(),
            password: _passwordController.text,
            phone: _phoneController.text.trim().isEmpty
                ? null
                : _phoneController.text.trim(),
          );
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
                        const SizedBox(height: 32),

                        // Logo
                        Container(
                          width: 64,
                          height: 64,
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
                                fontSize: 28,
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

                        const SizedBox(height: 12),

                        // Brand
                        Text(
                          'Turnly',
                          style: theme.textTheme.headlineLarge?.copyWith(
                            color: AppColors.accent,
                            fontWeight: FontWeight.w800,
                          ),
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 150.ms),

                        const SizedBox(height: 32),

                        // Title
                        Text(
                          'Crear Cuenta',
                          style: theme.textTheme.headlineMedium,
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 250.ms)
                            .slideY(
                              begin: 0.15,
                              end: 0,
                              duration: 500.ms,
                              delay: 250.ms,
                            ),

                        const SizedBox(height: 8),

                        Text(
                          'Completa tus datos para registrarte',
                          style: theme.textTheme.bodyMedium,
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 300.ms),

                        const SizedBox(height: 28),

                        // Google Sign-In button
                        GoogleSignInButton(
                          isLoading: state is AuthLoading,
                          onPressed: () {
                            context.read<AuthCubit>().loginWithGoogle();
                          },
                        ),

                        const SizedBox(height: 20),

                        // Divider — "or continue with email"
                        Row(
                          children: [
                            Expanded(child: Divider(color: Colors.grey.shade300)),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                                'o continúa con email',
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

                        // Name field
                        AppTextField(
                          label: 'Nombre completo',
                          hint: 'Tu nombre',
                          controller: _nameController,
                          keyboardType: TextInputType.name,
                          prefixIcon:
                              const Icon(Icons.person_outline_rounded, size: 20),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Ingresa tu nombre';
                            }
                            return null;
                          },
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 350.ms)
                            .slideY(
                              begin: 0.1,
                              end: 0,
                              duration: 500.ms,
                              delay: 350.ms,
                            ),

                        const SizedBox(height: 14),

                        // Email field
                        AppTextField(
                          label: 'Correo electronico',
                          hint: 'tu@email.com',
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          prefixIcon:
                              const Icon(Icons.email_outlined, size: 20),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Ingresa tu correo';
                            }
                            if (!value.contains('@')) {
                              return 'Correo invalido';
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

                        const SizedBox(height: 14),

                        // Password field
                        AppTextField(
                          label: 'Contrasena',
                          hint: 'Minimo 6 caracteres',
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          prefixIcon:
                              const Icon(Icons.lock_outline_rounded, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              size: 20,
                              color: AppColors.textTertiary,
                            ),
                            onPressed: () => setState(
                              () => _obscurePassword = !_obscurePassword,
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Ingresa una contrasena';
                            }
                            if (value.length < 6) {
                              return 'Minimo 6 caracteres';
                            }
                            return null;
                          },
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 450.ms)
                            .slideY(
                              begin: 0.1,
                              end: 0,
                              duration: 500.ms,
                              delay: 450.ms,
                            ),

                        const SizedBox(height: 14),

                        // Phone field (optional)
                        AppTextField(
                          label: 'Telefono (opcional)',
                          hint: '+1 234 567 8900',
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          prefixIcon:
                              const Icon(Icons.phone_outlined, size: 20),
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 500.ms)
                            .slideY(
                              begin: 0.1,
                              end: 0,
                              duration: 500.ms,
                              delay: 500.ms,
                            ),

                        const SizedBox(height: 28),

                        // Register button
                        AppButton(
                          label: 'Crear Cuenta',
                          isLoading: isLoading,
                          onPressed: _submit,
                          icon: Icons.person_add_outlined,
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 550.ms)
                            .slideY(
                              begin: 0.1,
                              end: 0,
                              duration: 500.ms,
                              delay: 550.ms,
                            ),

                        const SizedBox(height: 24),

                        // Login link
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Ya tienes cuenta? ',
                              style: theme.textTheme.bodyMedium,
                            ),
                            GestureDetector(
                              onTap: () => context.go('/login'),
                              child: Text(
                                'Inicia sesion',
                                style: TextStyle(
                                  color: AppColors.accent,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ],
                        )
                            .animate()
                            .fadeIn(duration: 500.ms, delay: 600.ms),

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
