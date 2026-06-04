// lib/features/reservations/presentation/widgets/step_indicator.dart
import 'package:flutter/material.dart';
import '../../../../app/theme/app_colors.dart';

class StepIndicator extends StatefulWidget {
  final int currentStep;
  final int totalSteps;
  final List<String>? labels;
  final Color? activeColor;
  final ValueChanged<int>? onStepTap;

  const StepIndicator({
    super.key,
    required this.currentStep,
    this.totalSteps = 3,
    this.labels,
    this.activeColor,
    this.onStepTap,
  });

  @override
  State<StepIndicator> createState() => _StepIndicatorState();
}

class _StepIndicatorState extends State<StepIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.activeColor ?? Theme.of(context).colorScheme.primary;
    final labels = widget.labels;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: LayoutBuilder(
        builder: (context, constraints) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 48,
                child: Row(
                  children: List.generate(widget.totalSteps, (index) {
                    final isLast = index == widget.totalSteps - 1;
                    return Expanded(
                      flex: isLast ? 0 : 1,
                      child: Row(
                        children: [
                          _StepDot(
                            index: index,
                            currentStep: widget.currentStep,
                            color: color,
                            pulse: _pulseController,
                            onTap: widget.onStepTap == null
                                ? null
                                : (index <= widget.currentStep
                                    ? () => widget.onStepTap!(index)
                                    : null),
                          ),
                          if (!isLast)
                            Expanded(
                              child: _Connector(
                                color: color,
                                filled: index < widget.currentStep,
                              ),
                            ),
                        ],
                      ),
                    );
                  }),
                ),
              ),
              if (labels != null && labels.length == widget.totalSteps) ...[
                const SizedBox(height: 6),
                Row(
                  children: List.generate(widget.totalSteps, (i) {
                    final isLast = i == widget.totalSteps - 1;
                    final isActive = i <= widget.currentStep;
                    final isCurrent = i == widget.currentStep;
                    return Expanded(
                      flex: isLast ? 0 : 1,
                      child: Row(
                        children: [
                          SizedBox(
                            width: 40,
                            child: Text(
                              labels[i],
                              textAlign: isLast ? TextAlign.end : TextAlign.start,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight:
                                    isCurrent ? FontWeight.w700 : FontWeight.w500,
                                color: isActive
                                    ? (isCurrent ? color : AppColors.textPrimary)
                                    : AppColors.textTertiary,
                                letterSpacing: 0.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.visible,
                              softWrap: false,
                            ),
                          ),
                          if (!isLast) const Spacer(),
                        ],
                      ),
                    );
                  }),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _StepDot extends StatelessWidget {
  final int index;
  final int currentStep;
  final Color color;
  final Animation<double> pulse;
  final VoidCallback? onTap;

  const _StepDot({
    required this.index,
    required this.currentStep,
    required this.color,
    required this.pulse,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final completed = index < currentStep;
    final current = index == currentStep;
    final active = completed || current;

    return Semantics(
      button: onTap != null,
      label: 'Paso ${index + 1}',
      selected: current,
      child: InkResponse(
        onTap: onTap,
        radius: 24,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (current)
                  AnimatedBuilder(
                    animation: pulse,
                    builder: (_, __) {
                      final t = pulse.value;
                      return Container(
                        width: 40 + (t * 6),
                        height: 40 + (t * 6),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: color.withValues(alpha: 0.18 * (1 - t)),
                        ),
                      );
                    },
                  ),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 280),
                  curve: Curves.easeOutCubic,
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: active ? color : AppColors.surface,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: active ? color : AppColors.border,
                      width: active ? 0 : 1.5,
                    ),
                    boxShadow: active
                        ? [
                            BoxShadow(
                              color: color.withValues(alpha: 0.28),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ]
                        : null,
                  ),
                  child: Center(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      transitionBuilder: (child, anim) => ScaleTransition(
                        scale: anim,
                        child: FadeTransition(opacity: anim, child: child),
                      ),
                      child: completed
                          ? const Icon(
                              Icons.check_rounded,
                              key: ValueKey('check'),
                              color: Colors.white,
                              size: 18,
                            )
                          : Text(
                              '${index + 1}',
                              key: ValueKey('num$index'),
                              style: TextStyle(
                                color: current
                                    ? Colors.white
                                    : AppColors.textTertiary,
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Connector extends StatelessWidget {
  final Color color;
  final bool filled;

  const _Connector({required this.color, required this.filled});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(2),
        child: SizedBox(
          height: 3,
          child: Stack(
            children: [
              Container(color: AppColors.border),
              LayoutBuilder(
                builder: (context, c) {
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 380),
                    curve: Curves.easeOutCubic,
                    width: filled ? c.maxWidth : 0,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          color.withValues(alpha: 0.85),
                          color,
                        ],
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
