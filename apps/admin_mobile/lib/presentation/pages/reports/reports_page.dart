import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../application/blocs/reports/reports_bloc.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';
import 'widgets/stats_cards.dart';
import 'widgets/revenue_chart.dart';
import 'widgets/payment_donut.dart';
import 'widgets/daily_breakdown_table.dart';

enum _RangePreset { today, thisWeek, thisMonth, lastMonth, custom }

class ReportsPage extends StatelessWidget {
  const ReportsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<ReportsBloc>(),
      child: const _ReportsView(),
    );
  }
}

class _ReportsView extends StatefulWidget {
  const _ReportsView();

  @override
  State<_ReportsView> createState() => _ReportsViewState();
}

class _ReportsViewState extends State<_ReportsView> {
  _RangePreset _selectedPreset = _RangePreset.thisWeek;
  DateTimeRange? _customRange;

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  (String, String) _getRange() {
    final now = DateTime.now();
    final fmt = DateFormat('yyyy-MM-dd');

    switch (_selectedPreset) {
      case _RangePreset.today:
        final d = fmt.format(now);
        return (d, d);
      case _RangePreset.thisWeek:
        final start = now.subtract(Duration(days: now.weekday - 1));
        return (fmt.format(start), fmt.format(now));
      case _RangePreset.thisMonth:
        final start = DateTime(now.year, now.month, 1);
        return (fmt.format(start), fmt.format(now));
      case _RangePreset.lastMonth:
        final start = DateTime(now.year, now.month - 1, 1);
        final end = DateTime(now.year, now.month, 0);
        return (fmt.format(start), fmt.format(end));
      case _RangePreset.custom:
        if (_customRange != null) {
          return (
            fmt.format(_customRange!.start),
            fmt.format(_customRange!.end)
          );
        }
        return (fmt.format(now), fmt.format(now));
    }
  }

  void _loadReport() {
    final (from, to) = _getRange();
    context.read<ReportsBloc>().add(LoadRangeReport(from: from, to: to));
  }

  void _selectPreset(_RangePreset preset) async {
    if (preset == _RangePreset.custom) {
      final picked = await showDateRangePicker(
        context: context,
        firstDate: DateTime.now().subtract(const Duration(days: 365)),
        lastDate: DateTime.now(),
        initialDateRange: _customRange ??
            DateTimeRange(
              start: DateTime.now().subtract(const Duration(days: 7)),
              end: DateTime.now(),
            ),
      );
      if (picked != null) {
        setState(() {
          _customRange = picked;
          _selectedPreset = _RangePreset.custom;
        });
        _loadReport();
      }
      return;
    }

    setState(() => _selectedPreset = preset);
    _loadReport();
  }

  String _presetLabel(_RangePreset preset) {
    switch (preset) {
      case _RangePreset.today:
        return 'Hoy';
      case _RangePreset.thisWeek:
        return 'Esta Semana';
      case _RangePreset.thisMonth:
        return 'Este Mes';
      case _RangePreset.lastMonth:
        return 'Mes Pasado';
      case _RangePreset.custom:
        return 'Custom';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Text(
                    'Reportes',
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontSize: 22),
                  ),
                  const Spacer(),
                ],
              ),
            ),

            // Range chips
            SizedBox(
              height: 52,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                children: _RangePreset.values.map((preset) {
                  final isSelected = _selectedPreset == preset;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => _selectPreset(preset),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.primary
                              : Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.cardBorder,
                          ),
                        ),
                        child: Center(
                          child: Text(
                            _presetLabel(preset),
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: isSelected
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                              color: isSelected
                                  ? Colors.white
                                  : AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),

            // Content
            Expanded(
              child: BlocBuilder<ReportsBloc, ReportsState>(
                builder: (context, state) {
                  if (state is ReportsLoading) {
                    return const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                      ),
                    );
                  }

                  if (state is ReportsError) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.error_outline,
                              color: AppColors.error, size: 40),
                          const SizedBox(height: 12),
                          Text(
                            state.message,
                            style:
                                const TextStyle(color: AppColors.textMuted),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: _loadReport,
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('Reintentar'),
                          ),
                        ],
                      ),
                    );
                  }

                  if (state is ReportsLoaded) {
                    final data = state.data;
                    final dailyData =
                        (data['daily'] as List<dynamic>?) ?? [];
                    final payments =
                        (data['payments'] as Map<String, dynamic>?) ?? {};

                    return RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () async {
                        _loadReport();
                        await context
                            .read<ReportsBloc>()
                            .stream
                            .firstWhere((s) => s is! ReportsLoading);
                      },
                      child: ListView(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 4),
                        children: [
                          // Stats cards
                          StatsCards(data: data),
                          const SizedBox(height: 16),

                          // Revenue chart
                          RevenueChart(dailyData: dailyData),
                          const SizedBox(height: 16),

                          // Payment donut
                          PaymentDonut(data: payments),
                          const SizedBox(height: 16),

                          // Daily breakdown
                          DailyBreakdownTable(dailyData: dailyData),
                          const SizedBox(height: 80),
                        ],
                      ),
                    );
                  }

                  return const SizedBox.shrink();
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
