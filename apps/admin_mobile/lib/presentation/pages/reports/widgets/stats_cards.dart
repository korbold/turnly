import 'package:flutter/material.dart';

import '../../../../shared/constants/colors.dart';

class StatsCards extends StatelessWidget {
  final Map<String, dynamic> data;

  const StatsCards({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    final totalServices = data['total_services'] ?? 0;
    final revenue = (data['total_revenue'] ?? 0).toDouble();
    final reservations = data['total_reservations'] ?? 0;
    final days = data['days'] ?? 1;
    final dailyAvg = days > 0 ? revenue / days : 0.0;

    return GridView.count(
      crossAxisCount: 2,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.6,
      children: [
        _StatCard(
          icon: Icons.receipt_long,
          label: 'Total Servicios',
          value: '$totalServices',
          color: AppColors.primary,
        ),
        _StatCard(
          icon: Icons.attach_money,
          label: 'Revenue',
          value: '\$${revenue.toStringAsFixed(0)}',
          color: AppColors.success,
        ),
        _StatCard(
          icon: Icons.event,
          label: 'Reservaciones',
          value: '$reservations',
          color: AppColors.info,
        ),
        _StatCard(
          icon: Icons.trending_up,
          label: 'Promedio Diario',
          value: '\$${dailyAvg.toStringAsFixed(0)}',
          color: AppColors.warning,
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 22),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          Text(
            label,
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
