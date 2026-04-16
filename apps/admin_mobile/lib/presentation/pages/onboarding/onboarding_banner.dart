import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../shared/constants/colors.dart';

class _OnboardingStep {
  final String title;
  final String route;
  final IconData icon;
  final bool Function(Map<String, dynamic> data) isComplete;

  const _OnboardingStep({
    required this.title,
    required this.route,
    required this.icon,
    required this.isComplete,
  });
}

final _steps = [
  _OnboardingStep(
    title: 'Configurar datos del negocio',
    route: '/settings/general',
    icon: Icons.store,
    isComplete: (d) => (d['name'] as String? ?? '').isNotEmpty,
  ),
  _OnboardingStep(
    title: 'Configurar horario',
    route: '/settings/schedule',
    icon: Icons.schedule,
    isComplete: (d) => (d['schedule'] as List?)?.isNotEmpty ?? false,
  ),
  _OnboardingStep(
    title: 'Agregar servicios',
    route: '/services',
    icon: Icons.local_car_wash,
    isComplete: (d) => (d['services_count'] as int? ?? 0) > 0,
  ),
  _OnboardingStep(
    title: 'Invitar equipo',
    route: '/team',
    icon: Icons.group_add,
    isComplete: (d) => (d['team_count'] as int? ?? 0) > 1,
  ),
  _OnboardingStep(
    title: 'Subir fotos',
    route: '/settings/gallery',
    icon: Icons.photo_library,
    isComplete: (d) => (d['gallery_count'] as int? ?? 0) > 0,
  ),
  _OnboardingStep(
    title: 'Personalizar marca',
    route: '/settings/brand',
    icon: Icons.palette,
    isComplete: (d) => d['brand_configured'] == true,
  ),
];

class OnboardingBanner extends StatefulWidget {
  final Map<String, dynamic> tenantData;

  const OnboardingBanner({super.key, required this.tenantData});

  @override
  State<OnboardingBanner> createState() => _OnboardingBannerState();
}

class _OnboardingBannerState extends State<OnboardingBanner> {
  static const _dismissKey = 'onboarding_dismissed';
  bool _dismissed = false;

  @override
  void initState() {
    super.initState();
    _checkDismissed();
  }

  Future<void> _checkDismissed() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_dismissKey) == true && mounted) {
      setState(() => _dismissed = true);
    }
  }

  Future<void> _dismiss() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_dismissKey, true);
    if (mounted) setState(() => _dismissed = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_dismissed) return const SizedBox.shrink();

    final completed =
        _steps.where((s) => s.isComplete(widget.tenantData)).length;
    final total = _steps.length;
    final progress = total > 0 ? completed / total : 0.0;

    if (completed == total) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primaryMuted,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withAlpha(51)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.rocket_launch,
                  color: AppColors.primary, size: 20),
              const SizedBox(width: 8),
              Text(
                'Configura tu negocio',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: AppColors.primary,
                    ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: _dismiss,
                child: const Text(
                  'Omitir',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: AppColors.primary.withAlpha(51),
              valueColor:
                  const AlwaysStoppedAnimation<Color>(AppColors.primary),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$completed de $total completados',
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 12),
          ...List.generate(_steps.length, (i) {
            final step = _steps[i];
            final done = step.isComplete(widget.tenantData);
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Icon(
                    done ? Icons.check_circle : Icons.radio_button_unchecked,
                    color: done ? AppColors.success : AppColors.textMuted,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      step.title,
                      style: TextStyle(
                        color: done
                            ? AppColors.textMuted
                            : AppColors.textPrimary,
                        fontSize: 13,
                        decoration:
                            done ? TextDecoration.lineThrough : null,
                      ),
                    ),
                  ),
                  if (!done)
                    GestureDetector(
                      onTap: () => context.push(step.route),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'Ir',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
