import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../application/blocs/settings/settings_bloc.dart';
import '../../../../injection.dart';
import '../../../../shared/constants/colors.dart';

const _dayNames = [
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
  'Domingo',
];

class ScheduleTab extends StatelessWidget {
  const ScheduleTab({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<SettingsBloc>()..add(const LoadSettings()),
      child: const _ScheduleView(),
    );
  }
}

class _ScheduleView extends StatefulWidget {
  const _ScheduleView();

  @override
  State<_ScheduleView> createState() => _ScheduleViewState();
}

class _ScheduleViewState extends State<_ScheduleView> {
  // Each day has a list of time ranges and an active flag
  final List<bool> _active = List.filled(7, true);
  final List<List<_TimeRange>> _ranges = List.generate(
    7,
    (_) => [const _TimeRange(start: '08:00', end: '17:00')],
  );
  final List<_BlockEntry> _blocks = [];
  bool _populated = false;

  void _populate(Map<String, dynamic> data) {
    if (_populated) return;
    _populated = true;

    final schedule = data['schedule'] as List<dynamic>? ?? [];
    for (final entry in schedule) {
      if (entry is Map<String, dynamic>) {
        final day = (entry['day_of_week'] as int?) ?? 0;
        if (day >= 1 && day <= 7) {
          final idx = day - 1;
          _active[idx] = entry['is_active'] as bool? ?? true;
          if (_ranges[idx].length == 1 &&
              _ranges[idx][0].start == '08:00') {
            _ranges[idx] = [];
          }
          _ranges[idx].add(_TimeRange(
            start: entry['start_time'] as String? ?? '08:00',
            end: entry['end_time'] as String? ?? '17:00',
          ));
        }
      }
    }

    final blocks = data['blocks'] as List<dynamic>? ?? [];
    for (final b in blocks) {
      if (b is Map<String, dynamic>) {
        _blocks.add(_BlockEntry(
          id: b['id'] as int? ?? 0,
          date: b['date'] as String? ?? '',
          reason: b['reason'] as String? ?? '',
        ));
      }
    }
  }

  Future<void> _pickTime(
      BuildContext context, int dayIdx, int rangeIdx, bool isStart) async {
    final current = isStart
        ? _ranges[dayIdx][rangeIdx].start
        : _ranges[dayIdx][rangeIdx].end;
    final parts = current.split(':');
    final initial = TimeOfDay(
      hour: int.tryParse(parts[0]) ?? 8,
      minute: int.tryParse(parts[1]) ?? 0,
    );
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
    );
    if (picked != null && mounted) {
      setState(() {
        final str =
            '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
        if (isStart) {
          _ranges[dayIdx][rangeIdx] =
              _TimeRange(start: str, end: _ranges[dayIdx][rangeIdx].end);
        } else {
          _ranges[dayIdx][rangeIdx] =
              _TimeRange(start: _ranges[dayIdx][rangeIdx].start, end: str);
        }
      });
    }
  }

  void _addBlock() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;

    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Motivo del bloqueo'),
        content: TextField(
          controller: reasonCtrl,
          decoration: const InputDecoration(hintText: 'Ej: Mantenimiento'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, reasonCtrl.text),
            child: const Text('Agregar'),
          ),
        ],
      ),
    );
    reasonCtrl.dispose();
    if (reason == null || !mounted) return;

    setState(() {
      _blocks.add(_BlockEntry(
        id: 0,
        date:
            '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
        reason: reason,
      ));
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Horario')),
      body: BlocConsumer<SettingsBloc, SettingsState>(
        listener: (context, state) {
          if (state is SettingsLoaded) {
            _populate(state.data);
          }
          if (state is SettingsError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: AppColors.error,
              ),
            );
          }
        },
        builder: (context, state) {
          if (state is SettingsLoading && !_populated) {
            return Shimmer.fromColors(
              baseColor: Colors.grey.shade300,
              highlightColor: Colors.grey.shade100,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: List.generate(
                  7,
                  (_) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Container(
                      height: 72,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('Horario semanal',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              ...List.generate(7, (i) => _buildDayCard(context, i)),
              const SizedBox(height: 24),
              Row(
                children: [
                  Text('Bloqueos',
                      style: Theme.of(context).textTheme.titleMedium),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: _addBlock,
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Agregar'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (_blocks.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Column(
                      children: [
                        Icon(Icons.block, size: 36, color: AppColors.textMuted),
                        SizedBox(height: 8),
                        Text(
                          'Sin bloqueos configurados',
                          style: TextStyle(color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ...List.generate(_blocks.length, (i) {
                  final b = _blocks[i];
                  return Card(
                    child: ListTile(
                      leading: const Icon(Icons.event_busy,
                          color: AppColors.error),
                      title: Text(b.date),
                      subtitle:
                          b.reason.isNotEmpty ? Text(b.reason) : null,
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline,
                            color: AppColors.error),
                        onPressed: () {
                          setState(() => _blocks.removeAt(i));
                        },
                      ),
                    ),
                  );
                }),
            ],
          );
        },
      ),
    );
  }

  Widget _buildDayCard(BuildContext context, int dayIdx) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    _dayNames[dayIdx],
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Switch(
                  value: _active[dayIdx],
                  onChanged: (v) => setState(() => _active[dayIdx] = v),
                  activeThumbColor: AppColors.primary,
                ),
              ],
            ),
            if (_active[dayIdx]) ...[
              ...List.generate(_ranges[dayIdx].length, (ri) {
                final r = _ranges[dayIdx][ri];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    children: [
                      _timeChip(context, r.start,
                          () => _pickTime(context, dayIdx, ri, true)),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text('-'),
                      ),
                      _timeChip(context, r.end,
                          () => _pickTime(context, dayIdx, ri, false)),
                      const SizedBox(width: 8),
                      if (_ranges[dayIdx].length > 1)
                        GestureDetector(
                          onTap: () {
                            setState(
                                () => _ranges[dayIdx].removeAt(ri));
                          },
                          child: const Icon(Icons.remove_circle_outline,
                              color: AppColors.error, size: 20),
                        ),
                    ],
                  ),
                );
              }),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () {
                    setState(() {
                      _ranges[dayIdx]
                          .add(const _TimeRange(start: '08:00', end: '17:00'));
                    });
                  },
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Agregar rango',
                      style: TextStyle(fontSize: 12)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _timeChip(
      BuildContext context, String time, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.primaryMuted,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          time,
          style: const TextStyle(
            color: AppColors.primary,
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}

class _TimeRange {
  final String start;
  final String end;

  const _TimeRange({required this.start, required this.end});
}

class _BlockEntry {
  final int id;
  final String date;
  final String reason;

  const _BlockEntry({
    required this.id,
    required this.date,
    required this.reason,
  });
}
