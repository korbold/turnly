import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../application/blocs/service_logs/service_logs_bloc.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';
import 'widgets/daily_summary_card.dart';
import 'widgets/service_log_card.dart';

class ServiceLogPage extends StatelessWidget {
  const ServiceLogPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<ServiceLogsBloc>(),
      child: const _ServiceLogView(),
    );
  }
}

class _ServiceLogView extends StatefulWidget {
  const _ServiceLogView();

  @override
  State<_ServiceLogView> createState() => _ServiceLogViewState();
}

class _ServiceLogViewState extends State<_ServiceLogView> {
  DateTime _selectedDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    _loadLogs();
  }

  void _loadLogs() {
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    context.read<ServiceLogsBloc>().add(LoadServiceLogs(date: dateStr));
  }

  void _changeDate(int delta) {
    setState(() {
      _selectedDate = _selectedDate.add(Duration(days: delta));
    });
    _loadLogs();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _loadLogs();
    }
  }

  String _dateLabel() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final selected =
        DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day);
    if (selected == today) return 'Hoy';
    if (selected == today.add(const Duration(days: 1))) return 'Manana';
    if (selected == today.subtract(const Duration(days: 1))) return 'Ayer';
    return DateFormat("d MMM yyyy", 'es').format(_selectedDate);
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
                    'Registro de Servicios',
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontSize: 20),
                  ),
                  const Spacer(),
                ],
              ),
            ),

            // Date selector
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.chevron_left),
                    onPressed: () => _changeDate(-1),
                    visualDensity: VisualDensity.compact,
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: _pickDate,
                      child: Text(
                        _dateLabel(),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.chevron_right),
                    onPressed: () => _changeDate(1),
                    visualDensity: VisualDensity.compact,
                  ),
                  IconButton(
                    icon: const Icon(Icons.calendar_today, size: 20),
                    onPressed: _pickDate,
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ),

            // Content
            Expanded(
              child: BlocBuilder<ServiceLogsBloc, ServiceLogsState>(
                builder: (context, state) {
                  if (state is ServiceLogsLoading) {
                    return const Center(
                      child: CircularProgressIndicator(
                          color: AppColors.primary),
                    );
                  }

                  if (state is ServiceLogsError) {
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
                            onPressed: _loadLogs,
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('Reintentar'),
                          ),
                        ],
                      ),
                    );
                  }

                  if (state is ServiceLogsLoaded) {
                    final logs = state.logs.data;
                    return RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () async {
                        _loadLogs();
                        await context
                            .read<ServiceLogsBloc>()
                            .stream
                            .firstWhere(
                                (s) => s is! ServiceLogsLoading);
                      },
                      child: ListView(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 4),
                        children: [
                          // Summary
                          if (state.summary != null) ...[
                            DailySummaryCard(summary: state.summary!),
                            const SizedBox(height: 16),
                          ],

                          // Logs header
                          Row(
                            children: [
                              const Text(
                                'Registros',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const Spacer(),
                              Text(
                                '${logs.length} servicios',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),

                          if (logs.isEmpty)
                            Container(
                              padding: const EdgeInsets.all(40),
                              child: const Column(
                                children: [
                                  Icon(Icons.receipt_long,
                                      size: 48,
                                      color: AppColors.textMuted),
                                  SizedBox(height: 12),
                                  Text(
                                    'Sin registros para esta fecha',
                                    style: TextStyle(
                                        color: AppColors.textMuted),
                                  ),
                                ],
                              ),
                            )
                          else
                            ...logs.reversed.map((log) => ServiceLogCard(
                                  log: log,
                                  onComplete: log.status == 'in_progress'
                                      ? () => context
                                          .read<ServiceLogsBloc>()
                                          .add(CompleteServiceLog(log.id))
                                      : null,
                                )),

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
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await context.push('/service-logs/new');
          if (mounted) _loadLogs();
        },
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}
