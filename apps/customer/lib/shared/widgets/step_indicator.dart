import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class StepIndicator extends StatelessWidget {
  final List<String> labels;
  final int currentStep;

  const StepIndicator({
    super.key,
    required this.labels,
    required this.currentStep,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: List.generate(labels.length * 2 - 1, (i) {
          if (i.isOdd) {
            final stepBefore = i ~/ 2;
            return Expanded(
              child: Container(
                height: 2,
                color: stepBefore < currentStep ? AppColors.primary : AppColors.border,
              ),
            );
          }
          final stepIndex = i ~/ 2;
          final isCompleted = stepIndex < currentStep;
          final isActive = stepIndex == currentStep;

          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: isCompleted || isActive ? AppColors.primary : Colors.transparent,
                  shape: BoxShape.circle,
                  border: !isCompleted && !isActive
                      ? Border.all(color: AppColors.border, width: 2)
                      : null,
                ),
                child: Center(
                  child: isCompleted
                      ? const Icon(Icons.check, color: Colors.white, size: 16)
                      : Text(
                          '${stepIndex + 1}',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: isActive ? Colors.white : AppColors.bodyText,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                labels[stepIndex],
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                  color: isActive || isCompleted ? AppColors.darkText : AppColors.bodyText,
                ),
              ),
            ],
          );
        }),
      ),
    );
  }
}
