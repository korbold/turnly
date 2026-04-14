// features/reservations/presentation/widgets/slot_picker.dart
import 'package:flutter/material.dart';
import '../../domain/repositories/i_reservation_repository.dart';
import '../../../../shared/extensions/date_extensions.dart';
import '../../../../core/theme/app_theme.dart';

class SlotPicker extends StatelessWidget {
  final List<AvailableSlot> slots;
  final DateTime? selected;
  final ValueChanged<DateTime> onSelected;

  const SlotPicker({
    super.key,
    required this.slots,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    if (slots.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No hay horarios disponibles.', style: TextStyle(color: AppColors.bodyText)),
        ),
      );
    }

    // Group by morning/afternoon
    final morning = slots.where((s) => s.start.hour < 12).toList();
    final afternoon = slots.where((s) => s.start.hour >= 12).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Legend
        Row(
          children: [
            _legendDot(AppColors.surface, border: AppColors.border),
            const SizedBox(width: 6),
            const Text('Disponible', style: TextStyle(fontSize: 11, color: AppColors.bodyText)),
            const SizedBox(width: 16),
            _legendDot(const Color(0xFFF5F5F5)),
            const SizedBox(width: 6),
            const Text('Ocupado', style: TextStyle(fontSize: 11, color: AppColors.bodyText)),
            const SizedBox(width: 16),
            _legendDot(AppColors.primary),
            const SizedBox(width: 6),
            const Text('Seleccionado', style: TextStyle(fontSize: 11, color: AppColors.bodyText)),
          ],
        ),
        if (morning.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('Manana', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.darkText)),
          const SizedBox(height: 8),
          _buildGrid(context, morning),
        ],
        if (afternoon.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('Tarde', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.darkText)),
          const SizedBox(height: 8),
          _buildGrid(context, afternoon),
        ],
      ],
    );
  }

  Widget _legendDot(Color color, {Color? border}) {
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: border != null ? Border.all(color: border) : null,
      ),
    );
  }

  Widget _buildGrid(BuildContext context, List<AvailableSlot> group) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 2.5,
      ),
      itemCount: group.length,
      itemBuilder: (context, i) {
        final slot = group[i];
        final isSelected = selected != null && selected!.isAtSameMomentAs(slot.start);
        final isAvailable = slot.available > 0;

        return GestureDetector(
          onTap: isAvailable ? () => onSelected(slot.start) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isSelected
                  ? AppColors.primary
                  : isAvailable
                      ? AppColors.surface
                      : const Color(0xFFF5F5F5),
              borderRadius: BorderRadius.circular(12),
              border: isSelected
                  ? null
                  : isAvailable
                      ? Border.all(color: AppColors.border)
                      : null,
              boxShadow: isSelected ? AppColors.buttonShadow : null,
            ),
            child: Text(
              slot.start.toDisplayTime(),
              style: TextStyle(
                fontSize: 14,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected
                    ? Colors.white
                    : isAvailable
                        ? AppColors.darkText
                        : AppColors.bodyText,
              ),
            ),
          ),
        );
      },
    );
  }
}
