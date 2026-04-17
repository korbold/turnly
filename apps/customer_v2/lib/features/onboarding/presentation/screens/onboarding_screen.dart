// lib/features/onboarding/presentation/screens/onboarding_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_button.dart';

class _OnboardingSlide {
  final IconData icon;
  final Color iconBackground;
  final String title;
  final String description;

  const _OnboardingSlide({
    required this.icon,
    required this.iconBackground,
    required this.title,
    required this.description,
  });
}

const _slides = [
  _OnboardingSlide(
    icon: Icons.explore_rounded,
    iconBackground: Color(0xFFEEF2FF),
    title: 'Descubre negocios',
    description:
        'Encuentra los mejores negocios cerca de ti y explora sus servicios, horarios y disponibilidad.',
  ),
  _OnboardingSlide(
    icon: Icons.calendar_today_rounded,
    iconBackground: Color(0xFFECFDF5),
    title: 'Reserva en segundos',
    description:
        'Elige la fecha y hora que prefieras y confirma tu cita de forma rápida y sencilla.',
  ),
  _OnboardingSlide(
    icon: Icons.history_rounded,
    iconBackground: Color(0xFFFFF7ED),
    title: 'Tu historial siempre contigo',
    description:
        'Lleva el control de todas tus reservas pasadas y futuras desde un solo lugar.',
  ),
];

const _iconColors = [
  AppColors.accent,
  AppColors.success,
  Color(0xFFF97316),
];

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_seen', true);
    if (mounted) {
      context.go('/login');
    }
  }

  void _next() {
    if (_currentPage < _slides.length - 1) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    } else {
      _completeOnboarding();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Skip button
            Align(
              alignment: Alignment.centerRight,
              child: Padding(
                padding: const EdgeInsets.only(top: 16, right: 16),
                child: TextButton(
                  onPressed: _completeOnboarding,
                  child: Text(
                    'Omitir',
                    style: TextStyle(
                      color: AppColors.textTertiary,
                      fontWeight: FontWeight.w500,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ),

            // Page view
            Expanded(
              child: PageView.builder(
                controller: _controller,
                onPageChanged: (index) =>
                    setState(() => _currentPage = index),
                itemCount: _slides.length,
                itemBuilder: (context, index) {
                  final slide = _slides[index];
                  return _SlideContent(
                    key: ValueKey(index),
                    slide: slide,
                    iconColor: _iconColors[index],
                  );
                },
              ),
            ),

            // Bottom section: indicator + button
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 40),
              child: Column(
                children: [
                  SmoothPageIndicator(
                    controller: _controller,
                    count: _slides.length,
                    effect: ExpandingDotsEffect(
                      activeDotColor: AppColors.accent,
                      dotColor: AppColors.border,
                      dotHeight: 8,
                      dotWidth: 8,
                      expansionFactor: 3,
                      spacing: 6,
                    ),
                  ),
                  const SizedBox(height: 32),
                  AppButton(
                    label: _currentPage == _slides.length - 1
                        ? 'Comenzar'
                        : 'Siguiente',
                    onPressed: _next,
                    icon: _currentPage == _slides.length - 1
                        ? Icons.arrow_forward_rounded
                        : null,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SlideContent extends StatelessWidget {
  final _OnboardingSlide slide;
  final Color iconColor;

  const _SlideContent({
    super.key,
    required this.slide,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Icon circle
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              color: slide.iconBackground,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: iconColor.withValues(alpha: 0.15),
                  blurRadius: 40,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Icon(
              slide.icon,
              size: 52,
              color: iconColor,
            ),
          )
              .animate()
              .fadeIn(duration: 500.ms, delay: 100.ms)
              .scale(
                begin: const Offset(0.8, 0.8),
                end: const Offset(1.0, 1.0),
                duration: 500.ms,
                delay: 100.ms,
                curve: Curves.easeOutBack,
              ),

          const SizedBox(height: 48),

          // Title
          Text(
            slide.title,
            style: theme.textTheme.headlineLarge,
            textAlign: TextAlign.center,
          )
              .animate()
              .fadeIn(duration: 500.ms, delay: 250.ms)
              .slideY(begin: 0.2, end: 0, duration: 500.ms, delay: 250.ms),

          const SizedBox(height: 16),

          // Description
          Text(
            slide.description,
            style: theme.textTheme.bodyLarge?.copyWith(
              color: AppColors.textSecondary,
              height: 1.6,
            ),
            textAlign: TextAlign.center,
          )
              .animate()
              .fadeIn(duration: 500.ms, delay: 400.ms)
              .slideY(begin: 0.2, end: 0, duration: 500.ms, delay: 400.ms),
        ],
      ),
    );
  }
}
