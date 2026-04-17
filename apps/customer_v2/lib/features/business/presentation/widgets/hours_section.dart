// lib/features/business/presentation/widgets/hours_section.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/tenant_theme.dart';
import '../../../explore/domain/entities/business_hours.dart';

class HoursSection extends StatelessWidget {
  final List<BusinessHours> hours;
  final TenantTheme tenantTheme;

  const HoursSection({
    super.key,
    required this.hours,
    required this.tenantTheme,
  });

  @override
  Widget build(BuildContext context) {
    if (hours.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.schedule_rounded,
                size: 48,
                color: AppColors.textTertiary,
              ),
              const SizedBox(height: 12),
              const Text(
                'Horarios no disponibles',
                style: TextStyle(
                  fontSize: 15,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final today = DateTime.now().weekday % 7; // Convert to 0=Sunday

    return ListView.separated(
      padding: const EdgeInsets.all(20),
      itemCount: hours.length,
      separatorBuilder: (_, __) => const Divider(
        color: AppColors.divider,
        height: 1,
      ),
      itemBuilder: (context, index) {
        final h = hours[index];
        final isToday = h.dayOfWeek == today;

        return Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          decoration: BoxDecoration(
            color: isToday ? tenantTheme.secondary.withValues(alpha: 0.5) : null,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              // Day name
              SizedBox(
                width: 110,
                child: Row(
                  children: [
                    if (isToday)
                      Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          color: tenantTheme.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                    Text(
                      h.dayName,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
                        color: isToday
                            ? tenantTheme.primary
                            : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),

              // Status + times
              Expanded(
                child: h.isOpen
                    ? Wrap(
                        spacing: 8,
                        children: h.ranges.map((r) {
                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.success.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '${r.start} - ${r.end}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: AppColors.success,
                              ),
                            ),
                          );
                        }).toList(),
                      )
                    : Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'Cerrado',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: AppColors.error,
                          ),
                        ),
                      ),
              ),
            ],
          ),
        )
            .animate()
            .fadeIn(duration: Duration(milliseconds: 300 + index * 50));
      },
    );
  }
}
