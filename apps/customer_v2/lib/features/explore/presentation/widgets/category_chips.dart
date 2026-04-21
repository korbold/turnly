// lib/features/explore/presentation/widgets/category_chips.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../app/theme/app_colors.dart';
import '../../data/repositories/explore_repository_impl.dart';
import '../../domain/entities/business_category.dart';

class CategoryChips extends StatefulWidget {
  final String? activeFilter;
  final ValueChanged<String?> onSelected;

  const CategoryChips({
    super.key,
    this.activeFilter,
    required this.onSelected,
  });

  @override
  State<CategoryChips> createState() => _CategoryChipsState();
}

class _CategoryChipsState extends State<CategoryChips> {
  List<BusinessCategory>? _categories;

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    final result = await ExploreRepositoryImpl().getCategories();
    if (mounted) {
      result.fold((_) {}, (cats) => setState(() => _categories = cats));
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = <MapEntry<String?, String>>[
      const MapEntry(null, '🏪 Todos'),
      ...(_categories ?? []).map((c) => MapEntry(c.slug, '${c.emoji} ${c.name}')),
    ];

    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final entry = items[index];
          final isActive = widget.activeFilter == entry.key;

          return GestureDetector(
            onTap: () => widget.onSelected(entry.key),
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
