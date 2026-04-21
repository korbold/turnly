// lib/features/explore/presentation/widgets/category_chips.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../app/theme/app_colors.dart';

class CategoryChips extends StatelessWidget {
  final String? activeFilter;
  final ValueChanged<String?> onSelected;

  const CategoryChips({
    super.key,
    this.activeFilter,
    required this.onSelected,
  });

  static const _categories = <String?, String>{
    null: '🏪 Todos',
    'car_wash': '🚗 Car Wash',
    'barbershop': '💈 Barberia',
    'spa': '🧖 Spa',
    'gym': '💪 Gym',
    'medical': '🏥 Medico',
  };

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: _categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final entry = _categories.entries.elementAt(index);
          final isActive = activeFilter == entry.key;

          return GestureDetector(
            onTap: () => onSelected(entry.key),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: isActive ? AppColors.accent : AppColors.surface,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: isActive ? AppColors.accent : AppColors.border,
                  width: 1.5,
                ),
                boxShadow: isActive
                    ? [
                        BoxShadow(
                          color: AppColors.accent.withValues(alpha: 0.25),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ]
                    : [],
              ),
              child: Text(
                entry.value,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isActive ? Colors.white : AppColors.textPrimary,
                ),
              ),
            ),
          ).animate().fadeIn(
                duration: Duration(milliseconds: 300 + index * 50),
              );
        },
      ),
    );
  }
}
