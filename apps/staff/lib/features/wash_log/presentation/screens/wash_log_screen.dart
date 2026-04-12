import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/wash_log.dart';
import '../../domain/entities/daily_summary.dart';
import '../../infrastructure/wash_log_repository_impl.dart';
import '../widgets/wash_log_card.dart';
import '../widgets/daily_summary_card.dart';

class WashLogScreen extends StatefulWidget {
  const WashLogScreen({super.key});

  @override
  State<WashLogScreen> createState() => _WashLogScreenState();
}

class _WashLogScreenState extends State<WashLogScreen> {
  final _repo = WashLogRepositoryImpl();
  DateTime _selectedDate = DateTime.now();
  List<WashLog> _logs = [];
  DailySummary? _summary;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  String get _dateStr => DateFormat('yyyy-MM-dd').format(_selectedDate);

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });

    final logsResult = await _repo.getByDate(_dateStr);
    final summaryResult = await _repo.getDailySummary(_dateStr);

    setState(() {
      _loading = false;
      logsResult.fold(
        (f) => _error = f.message,
        (logs) => _logs = logs,
      );
      summaryResult.fold(
        (f) => {}, // Ignore summary error
        (s) => _summary = s,
      );
    });
  }

  Future<void> _completeWash(String id) async {
    final result = await _repo.complete(id);
    if (!mounted) return;
    result.fold(
      (f) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message))),
      (_) => _loadData(),
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2024),
      lastDate: DateTime.now(),
      locale: const Locale('es'),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _loadData();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Libro Diario'),
        actions: [
          TextButton.icon(
            onPressed: _pickDate,
            icon: const Icon(Icons.calendar_today, size: 18),
            label: Text(DateFormat('d MMM').format(_selectedDate)),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                    const SizedBox(height: 8),
                    ElevatedButton(onPressed: _loadData, child: const Text('Reintentar')),
                  ],
                ))
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: Column(
                    children: [
                      if (_summary != null) DailySummaryCard(summary: _summary!),
                      Expanded(
                        child: _logs.isEmpty
                            ? const Center(child: Text('No hay lavados registrados', style: TextStyle(color: Colors.grey)))
                            : ListView.builder(
                                itemCount: _logs.length,
                                itemBuilder: (context, index) {
                                  final log = _logs[index];
                                  return WashLogCard(
                                    washLog: log,
                                    onComplete: log.isInProgress ? () => _completeWash(log.id) : null,
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await context.push('/wash-log/register');
          _loadData(); // Refresh after registering
        },
        icon: const Icon(Icons.add),
        label: const Text('Registrar'),
      ),
    );
  }
}
