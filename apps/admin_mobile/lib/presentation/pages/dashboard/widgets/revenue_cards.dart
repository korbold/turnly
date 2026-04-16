import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../domain/entities/service_log.dart';
import '../../../../shared/constants/colors.dart';

class RevenueCards extends StatelessWidget {
  final DailySummary? summary;

  const RevenueCards({super.key, this.summary});

  @override
  Widget build(BuildContext context) {
    final currencyFormat =
        NumberFormat.currency(locale: 'es', symbol: '\$', decimalDigits: 0);

    final todayRevenue = summary?.totalRevenue ?? 0;
    final todayCount = summary?.totalWashes ?? 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Resumen',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 120,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _RevenueCard(
                icon: Icons.today,
                label: 'Hoy',
                amount: currencyFormat.format(todayRevenue),
                subtitle: '$todayCount servicios',
                trendPercent: null,
              ),
              const SizedBox(width: 12),
              _RevenueCard(
                icon: Icons.date_range,
                label: 'Semana',
                amount: currencyFormat.format(todayRevenue * 5),
                subtitle: 'Estimado',
                trendPercent: 12.5,
              ),
              const SizedBox(width: 12),
              _RevenueCard(
                icon: Icons.calendar_month,
                label: 'Mes',
                amount: currencyFormat.format(todayRevenue * 22),
                subtitle: 'Estimado',
                trendPercent: -3.2,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RevenueCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String amount;
  final String subtitle;
  final double? trendPercent;

  const _RevenueCard({
    required this.icon,
    required this.label,
    required this.amount,
    required this.subtitle,
    this.trendPercent,
  });

  @override
  Widget build(BuildContext context) {
    final isPositive = (trendPercent ?? 0) >= 0;
    final trendColor = isPositive ? AppColors.success : AppColors.error;
    final trendArrow = isPositive ? '\u2191' : '\u2193';

    return Container(
      width: 160,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            amount,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (trendPercent != null) ...[
                const Spacer(),
                Text(
                  '$trendArrow${trendPercent!.abs().toStringAsFixed(1)}%',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: trendColor,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
