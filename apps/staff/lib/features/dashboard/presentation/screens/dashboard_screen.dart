import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../../shared/enums/user_role.dart';
import '../../../../shared/widgets/stat_card.dart';
import '../../domain/entities/daily_report.dart';
import '../../infrastructure/dashboard_repository_impl.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _repo = DashboardRepositoryImpl();
  final Dio _dio = DioClient.instance;

  UserRole _role = UserRole.washer;
  DailyReport? _report;
  List<Map<String, dynamic>> _upcomingReservations = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  String get _todayStr => DateFormat('yyyy-MM-dd').format(DateTime.now());

  Future<void> _init() async {
    final roleStr = await SecureStorage.getRole();
    setState(() {
      _role = roleStr != null ? UserRole.fromString(roleStr) : UserRole.washer;
    });
    await _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final result = await _repo.getDailyReport(_todayStr);

    if (!mounted) return;

    result.fold(
      (f) => setState(() {
        _error = f.message;
        _loading = false;
      }),
      (report) async {
        setState(() => _report = report);
        if (_role.isAdmin) {
          await _loadUpcomingReservations();
        }
        if (mounted) setState(() => _loading = false);
      },
    );
  }

  Future<void> _loadUpcomingReservations() async {
    try {
      final response = await _dio.get(
        '/reservations',
        queryParameters: {'status': 'confirmed', 'per_page': 5},
      );
      final data = response.data['data'] as List<dynamic>;
      if (mounted) {
        setState(() {
          _upcomingReservations = data.cast<Map<String, dynamic>>();
        });
      }
    } catch (_) {
      // Silently ignore — upcoming reservations are non-critical
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _loadData)
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _buildDateHeader(),
                      const SizedBox(height: 16),
                      _buildStatGrid(),
                      const SizedBox(height: 20),
                      _buildQuickActions(),
                      if (_role.isAdmin) ...[
                        const SizedBox(height: 24),
                        _buildRevenueBreakdown(),
                        const SizedBox(height: 24),
                        _buildUpcomingReservations(),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _buildDateHeader() {
    final formatted = DateFormat('EEEE, d MMMM yyyy', 'es').format(DateTime.now());
    return Text(
      formatted,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey),
    );
  }

  Widget _buildStatGrid() {
    final report = _report;
    if (report == null) return const SizedBox.shrink();

    final currency = NumberFormat.currency(locale: 'es', symbol: '\$', decimalDigits: 2);

    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        StatCard(
          title: 'Reservaciones hoy',
          value: '${report.totalReservations}',
          icon: Icons.calendar_today,
          iconColor: Colors.blue,
        ),
        StatCard(
          title: 'Lavados completados',
          value: '${report.completedWashes}',
          icon: Icons.check_circle,
          iconColor: Colors.green,
        ),
        StatCard(
          title: 'Ingresos del día',
          value: currency.format(report.revenue),
          icon: Icons.attach_money,
          iconColor: Colors.amber.shade700,
        ),
        StatCard(
          title: 'En progreso',
          value: '${report.inProgressWashes}',
          icon: Icons.hourglass_top,
          iconColor: Colors.purple,
        ),
      ],
    );
  }

  Widget _buildQuickActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Acciones rápidas', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () => context.push('/wash-log/register'),
            icon: const Icon(Icons.add),
            label: const Text('Registrar lavado'),
          ),
        ),
      ],
    );
  }

  Widget _buildRevenueBreakdown() {
    final report = _report;
    if (report == null) return const SizedBox.shrink();

    final currency = NumberFormat.currency(locale: 'es', symbol: '\$', decimalDigits: 2);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Ingresos por método de pago', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _PaymentRow(
                  label: 'Efectivo',
                  icon: Icons.money,
                  color: Colors.green,
                  amount: currency.format(report.revenueByPayment['cash'] ?? 0.0),
                ),
                const Divider(height: 20),
                _PaymentRow(
                  label: 'Tarjeta',
                  icon: Icons.credit_card,
                  color: Colors.blue,
                  amount: currency.format(report.revenueByPayment['card'] ?? 0.0),
                ),
                const Divider(height: 20),
                _PaymentRow(
                  label: 'Transferencia',
                  icon: Icons.account_balance,
                  color: Colors.purple,
                  amount: currency.format(report.revenueByPayment['transfer'] ?? 0.0),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildUpcomingReservations() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Próximas reservaciones', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        if (_upcomingReservations.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Center(
                child: Text('No hay reservaciones confirmadas', style: TextStyle(color: Colors.grey.shade600)),
              ),
            ),
          )
        else
          ...(_upcomingReservations.map((r) => _UpcomingReservationTile(data: r))),
      ],
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

class _PaymentRow extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final String amount;
  const _PaymentRow({required this.label, required this.icon, required this.color, required this.amount});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 12),
        Expanded(child: Text(label, style: const TextStyle(fontSize: 14))),
        Text(amount, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _UpcomingReservationTile extends StatelessWidget {
  final Map<String, dynamic> data;
  const _UpcomingReservationTile({required this.data});

  @override
  Widget build(BuildContext context) {
    final scheduledAt = data['scheduled_at'] as String?;
    DateTime? dt;
    if (scheduledAt != null) {
      try {
        dt = DateTime.parse(scheduledAt);
      } catch (_) {}
    }
    final timeStr = dt != null ? DateFormat('HH:mm').format(dt) : '--:--';

    final vehicle = data['vehicle'] as Map<String, dynamic>?;
    final service = data['service'] as Map<String, dynamic>?;
    final client = data['client'] as Map<String, dynamic>?;

    final plate = vehicle?['plate'] as String? ?? '-';
    final clientName = client?['name'] as String? ?? 'Cliente';
    final serviceName = service?['name'] as String? ?? '-';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.blue.withValues(alpha: 0.1),
          child: Text(timeStr, style: const TextStyle(fontSize: 11, color: Colors.blue, fontWeight: FontWeight.bold)),
        ),
        title: Text('$clientName — $plate'),
        subtitle: Text(serviceName),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
        onTap: () {
          final id = data['id'] as String?;
          if (id != null) context.push('/reservations/$id');
        },
      ),
    );
  }
}
