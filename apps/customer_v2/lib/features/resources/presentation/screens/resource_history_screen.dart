// lib/features/resources/presentation/screens/resource_history_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/shimmer_loader.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../domain/entities/service_history_entry.dart';
import '../../domain/repositories/resource_repository.dart';

class ResourceHistoryScreen extends StatefulWidget {
  final String resourceId;
  final String label;

  const ResourceHistoryScreen({
    super.key,
    required this.resourceId,
    required this.label,
  });

  @override
  State<ResourceHistoryScreen> createState() => _ResourceHistoryScreenState();
}

class _ResourceHistoryScreenState extends State<ResourceHistoryScreen> {
  List<ServiceHistoryEntry>? _entries;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final repo = getIt<ResourceRepository>();
    final result = await repo.getHistory(widget.resourceId);

    if (!mounted) return;

    result.fold(
      (failure) => setState(() {
        _error = failure.message;
        _loading = false;
      }),
      (entries) => setState(() {
        _entries = entries;
        _loading = false;
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
        title: Text(
          widget.label,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: true,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: ShimmerLoader.list(count: 5, itemHeight: 90),
      );
    }

    if (_error != null) {
      return EmptyState(
        icon: Icons.error_outline_rounded,
        title: 'Error al cargar historial',
        subtitle: _error,
        actionLabel: 'Reintentar',
        onAction: _loadHistory,
      );
    }

    if (_entries == null || _entries!.isEmpty) {
      return const EmptyState(
        icon: Icons.history_rounded,
        title: 'Sin historial',
        subtitle: 'Este registro aun no tiene servicios realizados',
      );
    }

    return RefreshIndicator(
      color: AppColors.accent,
      onRefresh: _loadHistory,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.all(20),
        itemCount: _entries!.length,
        itemBuilder: (context, index) {
          final entry = _entries![index];
          return _HistoryEntryCard(entry: entry, index: index);
        },
      ),
    );
  }
}

class _HistoryEntryCard extends StatelessWidget {
  final ServiceHistoryEntry entry;
  final int index;

  const _HistoryEntryCard({required this.entry, required this.index});

  Color _statusColor(String status) {
    return switch (status) {
      'completed' => AppColors.success,
      'cancelled' => AppColors.error,
      'in_progress' => const Color(0xFF8B5CF6),
      'pending' => AppColors.warning,
      _ => AppColors.info,
    };
  }

  String _statusLabel(String status) {
    return switch (status) {
      'completed' => 'Completado',
      'cancelled' => 'Cancelado',
      'in_progress' => 'En progreso',
      'pending' => 'Pendiente',
      _ => status,
    };
  }

  String _paymentLabel(String method) {
    return switch (method) {
      'cash' => 'Efectivo',
      'card' => 'Tarjeta',
      'transfer' => 'Transferencia',
      _ => method,
    };
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat("d 'de' MMM, yyyy", 'es');
    final timeFormat = DateFormat('HH:mm');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Service name + status
          Row(
            children: [
              Expanded(
                child: Text(
                  entry.serviceName,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              StatusBadge(
                label: _statusLabel(entry.status),
                color: _statusColor(entry.status),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Date
          Row(
            children: [
              const Icon(Icons.calendar_today_rounded,
                  size: 15, color: AppColors.textTertiary),
              const SizedBox(width: 6),
              Text(
                dateFormat.format(entry.startedAt),
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(width: 14),
              const Icon(Icons.access_time_rounded,
                  size: 15, color: AppColors.textTertiary),
              const SizedBox(width: 6),
              Text(
                timeFormat.format(entry.startedAt),
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Price + Payment method
          Row(
            children: [
              const Icon(Icons.attach_money_rounded,
                  size: 15, color: AppColors.textTertiary),
              const SizedBox(width: 6),
              Text(
                '\$${entry.priceCharged.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(width: 14),
              const Icon(Icons.payment_rounded,
                  size: 15, color: AppColors.textTertiary),
              const SizedBox(width: 6),
              Text(
                _paymentLabel(entry.paymentMethod),
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(
          duration: 400.ms,
          delay: (index * 80).ms,
        )
        .slideY(
          begin: 0.05,
          end: 0,
          duration: 400.ms,
          delay: (index * 80).ms,
        );
  }
}
