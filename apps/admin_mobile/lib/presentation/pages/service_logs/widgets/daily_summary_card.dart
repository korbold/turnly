import 'package:flutter/material.dart';

import '../../../../domain/entities/service_log.dart';
import '../../../../shared/constants/colors.dart';

class DailySummaryCard extends StatelessWidget {
  final DailySummary summary;

  const DailySummaryCard({super.key, required this.summary});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Resumen del dia',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _StatItem(
                icon: Icons.local_car_wash,
                label: 'Servicios',
                value: '${summary.totalWashes}',
                color: AppColors.primary,
              ),
              const SizedBox(width: 16),
              _StatItem(
                icon: Icons.attach_money,
                label: 'Ingresos',
                value: '\$${summary.totalRevenue.toStringAsFixed(2)}',
                color: AppColors.success,
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 12),
          // Payment method breakdown
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: _buildPaymentBreakdown(),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildPaymentBreakdown() {
    final methods = <String, IconData>{
      'cash': Icons.payments_outlined,
      'card': Icons.credit_card,
      'transfer': Icons.swap_horiz,
      'other': Icons.more_horiz,
    };
    final labels = <String, String>{
      'cash': 'Efectivo',
      'card': 'Tarjeta',
      'transfer': 'Transfer.',
      'other': 'Otro',
    };

    final widgets = <Widget>[];
    for (final entry in methods.entries) {
      final data = summary.byPaymentMethod[entry.key];
      if (data == null) continue;
      final amount = data is Map ? (data['total'] ?? 0) : data;
      final numAmount = amount is num ? amount.toDouble() : 0.0;
      if (numAmount == 0) continue;

      widgets.add(
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(entry.value, size: 16, color: AppColors.textMuted),
            const SizedBox(width: 4),
            Text(
              '${labels[entry.key]}',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textMuted,
              ),
            ),
            const SizedBox(width: 4),
            Text(
              '\$${numAmount.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      );
    }

    return widgets;
  }
}

class _StatItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatItem({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(icon, size: 24, color: color),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                  ),
                ),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
