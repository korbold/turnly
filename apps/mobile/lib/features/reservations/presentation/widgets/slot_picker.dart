import 'package:flutter/material.dart';
import '../../domain/repositories/i_reservation_repository.dart';
import '../../../../shared/extensions/date_extensions.dart';

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
          child: Text(
            'No hay horarios disponibles para esta fecha.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey),
          ),
        ),
      );
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: slots.map((slot) {
        final isSelected =
            selected != null && selected!.isAtSameMomentAs(slot.start);
        final isAvailable = slot.available > 0;
        final label = slot.start.toDisplayTime();

        return GestureDetector(
          onTap: isAvailable ? () => onSelected(slot.start) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isSelected
                  ? Theme.of(context).colorScheme.primary
                  : isAvailable
                      ? Theme.of(context).colorScheme.surface
                      : Colors.grey.shade200,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: isSelected
                    ? Theme.of(context).colorScheme.primary
                    : isAvailable
                        ? Theme.of(context).colorScheme.outline
                        : Colors.grey.shade300,
              ),
            ),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight:
                    isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected
                    ? Colors.white
                    : isAvailable
                        ? Theme.of(context).colorScheme.onSurface
                        : Colors.grey.shade400,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
