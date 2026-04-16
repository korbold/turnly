import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../../shared/constants/colors.dart';

class PaymentDonut extends StatelessWidget {
  final Map<String, dynamic> data;

  const PaymentDonut({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    final cash = (data['cash'] ?? 0).toDouble();
    final card = (data['card'] ?? 0).toDouble();
    final transfer = (data['transfer'] ?? 0).toDouble();
    final total = cash + card + transfer;

    if (total == 0) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: const Center(
          child: Text(
            'Sin datos de pago',
            style: TextStyle(color: AppColors.textMuted),
          ),
        ),
      );
    }

    final sections = <_PaymentSection>[
      _PaymentSection(
        label: 'Efectivo',
        value: cash,
        color: AppColors.success,
        percentage: (cash / total * 100).round(),
      ),
      _PaymentSection(
        label: 'Tarjeta',
        value: card,
        color: AppColors.info,
        percentage: (card / total * 100).round(),
      ),
      _PaymentSection(
        label: 'Transferencia',
        value: transfer,
        color: AppColors.warning,
        percentage: (transfer / total * 100).round(),
      ),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Metodos de Pago',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              // Donut chart
              SizedBox(
                width: 120,
                height: 120,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    PieChart(
                      PieChartData(
                        sectionsSpace: 2,
                        centerSpaceRadius: 35,
                        sections: sections
                            .where((s) => s.value > 0)
                            .map((s) => PieChartSectionData(
                                  value: s.value,
                                  color: s.color,
                                  radius: 20,
                                  showTitle: false,
                                ))
                            .toList(),
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '\$${total.toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const Text(
                          'Total',
                          style: TextStyle(
                            fontSize: 10,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 20),

              // Legend
              Expanded(
                child: Column(
                  children: sections.map((s) => _LegendRow(section: s)).toList(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PaymentSection {
  final String label;
  final double value;
  final Color color;
  final int percentage;

  const _PaymentSection({
    required this.label,
    required this.value,
    required this.color,
    required this.percentage,
  });
}

class _LegendRow extends StatelessWidget {
  final _PaymentSection section;

  const _LegendRow({required this.section});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: section.color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              section.label,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Text(
            '\$${section.value.toStringAsFixed(0)}',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            '${section.percentage}%',
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}
