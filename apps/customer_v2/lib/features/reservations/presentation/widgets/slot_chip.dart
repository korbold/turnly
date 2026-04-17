// lib/features/reservations/presentation/widgets/slot_chip.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../app/theme/app_colors.dart';
import '../../domain/entities/available_slot.dart';

class SlotChip extends StatelessWidget {
  final AvailableSlot slot;
  final bool isSelected;
  final Color? activeColor;
  final VoidCallback? onTap;

  const SlotChip({
    super.key,
    required this.slot,
    this.isSelected = false,
    this.activeColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = activeColor ?? Theme.of(context).colorScheme.primary;
    final timeFormat = DateFormat('HH:mm');
    final timeLabel = timeFormat.format(slot.start);
    final available = slot.isAvailable;

    return GestureDetector(
      onTap: available ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected
              ? color
              : available
                  ? color.withValues(alpha: 0.08)
                  : AppColors.divider,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isSelected
                ? color
                : available
                    ? color.withValues(alpha: 0.2)
                    : AppColors.border,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: color.withValues(alpha: 0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          timeLabel,
          style: TextStyle(
            fontSize: 14,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected
                ? Colors.white
                : available
                    ? AppColors.textPrimary
                    : AppColors.textTertiary,
          ),
        ),
      ),
    );
  }
}
