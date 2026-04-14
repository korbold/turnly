// features/client_resources/presentation/screens/client_resource_history_screen.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/wash_history_entry.dart';
import '../../infrastructure/client_resource_repository_impl.dart';
import '../../../../core/theme/app_theme.dart';

class ClientResourceHistoryScreen extends StatefulWidget {
  final String clientResourceId;
  final String label;

  const ClientResourceHistoryScreen({
    super.key,
    required this.clientResourceId,
    required this.label,
  });

  @override
  State<ClientResourceHistoryScreen> createState() => _ClientResourceHistoryScreenState();
}

class _ClientResourceHistoryScreenState extends State<ClientResourceHistoryScreen> {
  final _repo = ClientResourceRepositoryImpl();
  List<WashHistoryEntry> _entries = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final result = await _repo.getHistory(widget.clientResourceId);
    if (!mounted) return;
    result.fold(
      (failure) => setState(() { _error = failure.message; _loading = false; }),
      (entries) => setState(() { _entries = entries; _loading = false; }),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'completed': return AppColors.success;
      case 'in_progress': return const Color(0xFF3B82F6);
      case 'cancelled': return AppColors.error;
      default: return AppColors.bodyText;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'completed': return 'Completado';
      case 'in_progress': return 'En proceso';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Historial - ${widget.label}')),
      body: Builder(builder: (_) {
        if (_loading) return const Center(child: CircularProgressIndicator());
        if (_error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(_error!, style: const TextStyle(color: AppColors.error)),
                const SizedBox(height: 16),
                OutlinedButton(onPressed: _load, child: const Text('Reintentar')),
              ],
            ),
          );
        }
        if (_entries.isEmpty) {
          return const Center(child: Text('Este recurso aun no tiene historial.', style: TextStyle(color: AppColors.bodyText)));
        }
        return RefreshIndicator(
          onRefresh: _load,
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            itemCount: _entries.length,
            itemBuilder: (context, index) {
              final entry = _entries[index];
              final isLast = index == _entries.length - 1;
              final color = _statusColor(entry.status);
              final dateFormat = DateFormat('dd MMM yyyy, HH:mm', 'es');
              final currency = NumberFormat.currency(symbol: '\$', decimalDigits: 2);

              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Timeline
                    SizedBox(
                      width: 24,
                      child: Column(
                        children: [
                          Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                            ),
                          ),
                          if (!isLast)
                            Expanded(
                              child: Container(
                                width: 2,
                                color: AppColors.border,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Content
                    Expanded(
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: AppColors.cardShadow,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(entry.serviceName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(_statusLabel(entry.status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(dateFormat.format(entry.startedAt), style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(entry.paymentMethod, style: const TextStyle(fontSize: 12, color: AppColors.bodyText)),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.surfaceVariant,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    currency.format(entry.priceCharged),
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      }),
    );
  }
}
