import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../application/blocs/clients/clients_bloc.dart';
import '../../../domain/entities/client_resource.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';

class ClientDetailPage extends StatelessWidget {
  final String clientId;

  const ClientDetailPage({super.key, required this.clientId});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) =>
          getIt<ClientsBloc>()..add(LoadClient(int.parse(clientId))),
      child: _ClientDetailView(clientId: clientId),
    );
  }
}

class _ClientDetailView extends StatelessWidget {
  final String clientId;

  const _ClientDetailView({required this.clientId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Detalle del Cliente'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () =>
                context.push('/clients/create', extra: clientId),
          ),
        ],
      ),
      body: BlocBuilder<ClientsBloc, ClientsState>(
        builder: (context, state) {
          if (state is ClientsLoading) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            );
          }

          if (state is ClientsError) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline,
                      color: AppColors.error, size: 40),
                  const SizedBox(height: 12),
                  Text(
                    state.message,
                    style: const TextStyle(color: AppColors.textMuted),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () => context
                        .read<ClientsBloc>()
                        .add(LoadClient(int.parse(clientId))),
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Reintentar'),
                  ),
                ],
              ),
            );
          }

          if (state is ClientDetailLoaded) {
            return _DetailContent(
              client: state.client,
              history: state.history,
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }
}

class _DetailContent extends StatelessWidget {
  final ClientResource client;
  final List<dynamic> history;

  const _DetailContent({required this.client, required this.history});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          // Client info header
          Container(
            width: double.infinity,
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: AppColors.primaryMuted,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.directions_car,
                        color: AppColors.primary,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            client.plate ?? 'Sin placa',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          if (client.clientName != null)
                            Text(
                              client.clientName!,
                              style: const TextStyle(
                                fontSize: 14,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          if (client.clientEmail != null)
                            Text(
                              client.clientEmail!,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textMuted,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (client.brand != null ||
                    client.model != null ||
                    client.color != null) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      if (client.brand != null)
                        _InfoChip(
                            label: 'Marca', value: client.brand!),
                      if (client.model != null)
                        _InfoChip(
                            label: 'Modelo', value: client.model!),
                      if (client.color != null)
                        _InfoChip(
                            label: 'Color', value: client.color!),
                      if (client.type != null)
                        _InfoChip(label: 'Tipo', value: client.type!),
                    ],
                  ),
                ],
                // Custom fields from data
                if (client.data != null && client.data!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Divider(height: 1),
                  const SizedBox(height: 12),
                  ...client.data!.entries.map((entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          children: [
                            Text(
                              '${entry.key}: ',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            Expanded(
                              child: Text(
                                '${entry.value}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      )),
                ],
              ],
            ),
          ),

          // Stats row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _StatCard(
                  icon: Icons.receipt_long,
                  label: 'Visitas',
                  value: '${history.length}',
                  color: AppColors.primary,
                ),
                const SizedBox(width: 8),
                _StatCard(
                  icon: Icons.attach_money,
                  label: 'Total',
                  value: _totalSpent(),
                  color: AppColors.success,
                ),
                const SizedBox(width: 8),
                _StatCard(
                  icon: Icons.schedule,
                  label: 'Ultima',
                  value: _lastVisitLabel(),
                  color: AppColors.info,
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // TabBar
          const TabBar(
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textMuted,
            indicatorColor: AppColors.primary,
            tabs: [
              Tab(text: 'Servicios'),
              Tab(text: 'Reservas'),
            ],
          ),

          // TabBarView
          Expanded(
            child: TabBarView(
              children: [
                _HistoryList(
                  items: history
                      .where((h) =>
                          h is Map && h['type'] != 'reservation')
                      .toList(),
                  emptyLabel: 'Sin servicios registrados',
                  emptyIcon: Icons.receipt_long,
                ),
                _HistoryList(
                  items: history
                      .where(
                          (h) => h is Map && h['type'] == 'reservation')
                      .toList(),
                  emptyLabel: 'Sin reservas registradas',
                  emptyIcon: Icons.event,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _totalSpent() {
    double total = 0;
    for (final h in history) {
      if (h is Map && h['price_charged'] != null) {
        total += (h['price_charged'] as num).toDouble();
      }
    }
    return '\$${total.toStringAsFixed(0)}';
  }

  String _lastVisitLabel() {
    if (history.isEmpty) return 'N/A';
    return 'Reciente';
  }
}

class _InfoChip extends StatelessWidget {
  final String label;
  final String value;

  const _InfoChip({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        '$label: $value',
        style: const TextStyle(
          fontSize: 12,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryList extends StatelessWidget {
  final List<dynamic> items;
  final String emptyLabel;
  final IconData emptyIcon;

  const _HistoryList({
    required this.items,
    required this.emptyLabel,
    required this.emptyIcon,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(emptyIcon, size: 40, color: AppColors.textMuted),
            const SizedBox(height: 8),
            Text(
              emptyLabel,
              style: const TextStyle(color: AppColors.textMuted),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        if (item is! Map) return const SizedBox.shrink();
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['service_name']?.toString() ??
                          item['description']?.toString() ??
                          'Servicio',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (item['created_at'] != null)
                      Text(
                        item['created_at'].toString().substring(0, 10),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textMuted,
                        ),
                      ),
                  ],
                ),
              ),
              if (item['price_charged'] != null)
                Text(
                  '\$${(item['price_charged'] as num).toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.success,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
