import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../../shared/constants/colors.dart';

class RevenueChart extends StatelessWidget {
  final List<dynamic> dailyData;

  const RevenueChart({super.key, required this.dailyData});

  @override
  Widget build(BuildContext context) {
    if (dailyData.isEmpty) {
      return Container(
        height: 200,
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: const Center(
          child: Text(
            'Sin datos para el rango seleccionado',
            style: TextStyle(color: AppColors.textMuted),
          ),
        ),
      );
    }

    final spots = <FlSpot>[];
    double maxY = 0;
    for (int i = 0; i < dailyData.length; i++) {
      final item = dailyData[i];
      final revenue = (item is Map ? (item['revenue'] ?? 0) : 0).toDouble();
      spots.add(FlSpot(i.toDouble(), revenue));
      if (revenue > maxY) maxY = revenue;
    }

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
            'Revenue por Dia',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 180,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: maxY > 0 ? maxY / 4 : 1,
                  getDrawingHorizontalLine: (value) => const FlLine(
                    color: AppColors.cardBorder,
                    strokeWidth: 1,
                  ),
                ),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 42,
                      getTitlesWidget: (value, meta) {
                        return Text(
                          '\$${value.toInt()}',
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppColors.textMuted,
                          ),
                        );
                      },
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      interval: dailyData.length > 7
                          ? (dailyData.length / 5).ceilToDouble()
                          : 1,
                      getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index < 0 || index >= dailyData.length) {
                          return const SizedBox.shrink();
                        }
                        final item = dailyData[index];
                        final date = item is Map
                            ? (item['date']?.toString() ?? '')
                            : '';
                        // Show only day part
                        final dayPart = date.length >= 10
                            ? date.substring(8, 10)
                            : date;
                        return Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            dayPart,
                            style: const TextStyle(
                              fontSize: 10,
                              color: AppColors.textMuted,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    color: AppColors.primary,
                    barWidth: 2.5,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: AppColors.primary.withValues(alpha: 0.12),
                    ),
                  ),
                ],
                minY: 0,
                maxY: maxY * 1.1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
