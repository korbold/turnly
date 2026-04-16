import 'package:flutter/material.dart';

import '../../../../shared/constants/colors.dart';

class DailyBreakdownTable extends StatelessWidget {
  final List<dynamic> dailyData;

  const DailyBreakdownTable({super.key, required this.dailyData});

  @override
  Widget build(BuildContext context) {
    if (dailyData.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Text(
              'Desglose Diario',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowHeight: 40,
              dataRowMinHeight: 36,
              dataRowMaxHeight: 40,
              columnSpacing: 20,
              horizontalMargin: 16,
              headingTextStyle: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
              dataTextStyle: const TextStyle(
                fontSize: 12,
                color: AppColors.textPrimary,
              ),
              columns: const [
                DataColumn(label: Text('Fecha')),
                DataColumn(label: Text('Servicios'), numeric: true),
                DataColumn(label: Text('Revenue'), numeric: true),
                DataColumn(label: Text('Efectivo'), numeric: true),
                DataColumn(label: Text('Tarjeta'), numeric: true),
                DataColumn(label: Text('Transfer'), numeric: true),
                DataColumn(label: Text('Reservas'), numeric: true),
              ],
              rows: dailyData.map((item) {
                if (item is! Map) {
                  return const DataRow(cells: [
                    DataCell(Text('-')),
                    DataCell(Text('-')),
                    DataCell(Text('-')),
                    DataCell(Text('-')),
                    DataCell(Text('-')),
                    DataCell(Text('-')),
                    DataCell(Text('-')),
                  ]);
                }
                final date = item['date']?.toString() ?? '';
                final shortDate =
                    date.length >= 10 ? date.substring(5, 10) : date;
                return DataRow(cells: [
                  DataCell(Text(shortDate)),
                  DataCell(Text('${item['services'] ?? 0}')),
                  DataCell(Text(
                      '\$${((item['revenue'] ?? 0) as num).toStringAsFixed(0)}')),
                  DataCell(Text(
                      '\$${((item['cash'] ?? 0) as num).toStringAsFixed(0)}')),
                  DataCell(Text(
                      '\$${((item['card'] ?? 0) as num).toStringAsFixed(0)}')),
                  DataCell(Text(
                      '\$${((item['transfer'] ?? 0) as num).toStringAsFixed(0)}')),
                  DataCell(Text('${item['reservations'] ?? 0}')),
                ]);
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
