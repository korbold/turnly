import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../infrastructure/report_repository_impl.dart';

class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Reportes'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Diario'),
              Tab(text: 'Semanal'),
              Tab(text: 'Mensual'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _DailyTab(),
            _WeeklyTab(),
            _MonthlyTab(),
          ],
        ),
      ),
    );
  }
}

// ─── Daily Tab ───────────────────────────────────────────────────────────────

class _DailyTab extends StatefulWidget {
  const _DailyTab();

  @override
  State<_DailyTab> createState() => _DailyTabState();
}

class _DailyTabState extends State<_DailyTab> {
  final _repo = ReportRepositoryImpl();
  DateTime _date = DateTime.now();
  Map<String, dynamic>? _data;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String get _dateStr => DateFormat('yyyy-MM-dd').format(_date);

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await _repo.getDailyReport(_dateStr);
    if (!mounted) return;
    setState(() {
      _loading = false;
      result.fold((f) => _error = f.message, (d) => _data = d);
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2024),
      lastDate: DateTime.now(),
    );
    if (picked != null && mounted) {
      setState(() => _date = picked);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _DatePickerBar(
          label: DateFormat('d MMMM yyyy', 'es').format(_date),
          onTap: _pickDate,
        ),
        Expanded(child: _buildBody()),
      ],
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return _ErrorView(message: _error!, onRetry: _load);
    if (_data == null) return const SizedBox.shrink();

    final data = _data!;
    final currency = NumberFormat.currency(locale: 'es', symbol: '\$', decimalDigits: 2);

    final totalWashes = _extract(data, 'total_washes');
    final totalRevenue = _extractDouble(data, 'total_revenue');
    final paymentBreakdown = data['payment_breakdown'] as Map<String, dynamic>?;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _StatCard(title: 'Total servicios', value: '$totalWashes', icon: Icons.event_available, iconColor: Colors.blue),
          const SizedBox(height: 12),
          _StatCard(title: 'Ingresos totales', value: currency.format(totalRevenue), icon: Icons.attach_money, iconColor: Colors.green),
          if (paymentBreakdown != null) ...[
            const SizedBox(height: 20),
            Text('Desglose por método de pago', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: paymentBreakdown.entries.map((e) {
                    final amount = (e.value as num?)?.toDouble() ?? 0.0;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(_paymentLabel(e.key), style: const TextStyle(fontSize: 14)),
                          Text(currency.format(amount), style: const TextStyle(fontWeight: FontWeight.w600)),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Weekly Tab ──────────────────────────────────────────────────────────────

class _WeeklyTab extends StatefulWidget {
  const _WeeklyTab();

  @override
  State<_WeeklyTab> createState() => _WeeklyTabState();
}

class _WeeklyTabState extends State<_WeeklyTab> {
  final _repo = ReportRepositoryImpl();
  // Week represented as the Monday of the week
  late DateTime _weekStart;
  Map<String, dynamic>? _data;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    // Get Monday of current week
    _weekStart = now.subtract(Duration(days: now.weekday - 1));
    _load();
  }

  // ISO week: YYYY-Www
  String get _weekStr {
    final weekNumber = _isoWeekNumber(_weekStart);
    return '${_weekStart.year}-W${weekNumber.toString().padLeft(2, '0')}';
  }

  int _isoWeekNumber(DateTime date) {
    final dayOfYear = int.parse(DateFormat('D').format(date));
    final dayOfWeek = date.weekday;
    return ((dayOfYear - dayOfWeek + 10) / 7).floor();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await _repo.getWeeklyReport(_weekStr);
    if (!mounted) return;
    setState(() {
      _loading = false;
      result.fold((f) => _error = f.message, (d) => _data = d);
    });
  }

  void _prevWeek() {
    setState(() => _weekStart = _weekStart.subtract(const Duration(days: 7)));
    _load();
  }

  void _nextWeek() {
    final next = _weekStart.add(const Duration(days: 7));
    if (next.isAfter(DateTime.now())) return;
    setState(() => _weekStart = next);
    _load();
  }

  String get _weekLabel {
    final end = _weekStart.add(const Duration(days: 6));
    return '${DateFormat('d MMM', 'es').format(_weekStart)} – ${DateFormat('d MMM yyyy', 'es').format(end)}';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _WeekPickerBar(label: _weekLabel, onPrev: _prevWeek, onNext: _nextWeek),
        Expanded(child: _buildBody()),
      ],
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return _ErrorView(message: _error!, onRetry: _load);
    if (_data == null) return const SizedBox.shrink();

    final data = _data!;
    final currency = NumberFormat.currency(locale: 'es', symbol: '\$', decimalDigits: 2);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _StatCard(title: 'Total servicios', value: '${_extract(data, 'total_washes')}', icon: Icons.event_available, iconColor: Colors.blue),
          const SizedBox(height: 12),
          _StatCard(title: 'Ingresos totales', value: currency.format(_extractDouble(data, 'total_revenue')), icon: Icons.attach_money, iconColor: Colors.green),
        ],
      ),
    );
  }
}

// ─── Monthly Tab ─────────────────────────────────────────────────────────────

class _MonthlyTab extends StatefulWidget {
  const _MonthlyTab();

  @override
  State<_MonthlyTab> createState() => _MonthlyTabState();
}

class _MonthlyTabState extends State<_MonthlyTab> {
  final _repo = ReportRepositoryImpl();
  late DateTime _month;
  Map<String, dynamic>? _data;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
    _load();
  }

  String get _monthStr => DateFormat('yyyy-MM').format(_month);

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await _repo.getMonthlyReport(_monthStr);
    if (!mounted) return;
    setState(() {
      _loading = false;
      result.fold((f) => _error = f.message, (d) => _data = d);
    });
  }

  void _prevMonth() {
    setState(() => _month = DateTime(_month.year, _month.month - 1));
    _load();
  }

  void _nextMonth() {
    final next = DateTime(_month.year, _month.month + 1);
    if (next.isAfter(DateTime.now())) return;
    setState(() => _month = next);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _WeekPickerBar(
          label: DateFormat('MMMM yyyy', 'es').format(_month),
          onPrev: _prevMonth,
          onNext: _nextMonth,
        ),
        Expanded(child: _buildBody()),
      ],
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return _ErrorView(message: _error!, onRetry: _load);
    if (_data == null) return const SizedBox.shrink();

    final data = _data!;
    final currency = NumberFormat.currency(locale: 'es', symbol: '\$', decimalDigits: 2);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _StatCard(title: 'Total servicios', value: '${_extract(data, 'total_washes')}', icon: Icons.event_available, iconColor: Colors.blue),
          const SizedBox(height: 12),
          _StatCard(title: 'Ingresos totales', value: currency.format(_extractDouble(data, 'total_revenue')), icon: Icons.attach_money, iconColor: Colors.green),
        ],
      ),
    );
  }
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

dynamic _extract(Map<String, dynamic> data, String key) {
  // Try nested under 'data' key first, then top-level
  final nested = data['data'];
  if (nested is Map<String, dynamic> && nested.containsKey(key)) {
    return nested[key];
  }
  return data[key] ?? 0;
}

double _extractDouble(Map<String, dynamic> data, String key) {
  final value = _extract(data, key);
  return (value as num?)?.toDouble() ?? 0.0;
}

String _paymentLabel(String key) {
  switch (key) {
    case 'cash':
      return 'Efectivo';
    case 'card':
      return 'Tarjeta';
    case 'transfer':
      return 'Transferencia';
    default:
      return key;
  }
}

// ─── Shared widgets ──────────────────────────────────────────────────────────

class _DatePickerBar extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _DatePickerBar({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          border: Border(bottom: BorderSide(color: Colors.grey.shade300)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.calendar_today, size: 18),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_drop_down),
          ],
        ),
      ),
    );
  }
}

class _WeekPickerBar extends StatelessWidget {
  final String label;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  const _WeekPickerBar({required this.label, required this.onPrev, required this.onNext});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        border: Border(bottom: BorderSide(color: Colors.grey.shade300)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(icon: const Icon(Icons.chevron_left), onPressed: onPrev),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          IconButton(icon: const Icon(Icons.chevron_right), onPressed: onNext),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color iconColor;

  const _StatCard({required this.title, required this.value, required this.icon, required this.iconColor});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 28),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                const SizedBox(height: 4),
                Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: onRetry, child: const Text('Reintentar')),
        ],
      ),
    );
  }
}
