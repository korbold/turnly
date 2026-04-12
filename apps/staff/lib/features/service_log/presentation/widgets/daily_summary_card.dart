import 'package:flutter/material.dart';
import '../../domain/entities/daily_summary.dart';

class DailySummaryCard extends StatelessWidget {
  final DailySummary summary;
  const DailySummaryCard({super.key, required this.summary});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.3),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _SummaryItem(label: 'Lavados', value: '${summary.totalWashes}'),
                _SummaryItem(label: 'Ingresos', value: '\$${summary.totalRevenue.toStringAsFixed(2)}'),
                _SummaryItem(label: 'En curso', value: '${summary.inProgress}'),
              ],
            ),
            if (summary.byPaymentMethod.isNotEmpty) ...[
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _PaymentItem(label: 'Efectivo', total: summary.byPaymentMethod['cash']?.total ?? 0),
                  _PaymentItem(label: 'Tarjeta', total: summary.byPaymentMethod['card']?.total ?? 0),
                  _PaymentItem(label: 'Transfer.', total: summary.byPaymentMethod['transfer']?.total ?? 0),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SummaryItem extends StatelessWidget {
  final String label;
  final String value;
  const _SummaryItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
      ],
    );
  }
}

class _PaymentItem extends StatelessWidget {
  final String label;
  final double total;
  const _PaymentItem({required this.label, required this.total});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('\$${total.toStringAsFixed(2)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
      ],
    );
  }
}
