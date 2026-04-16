import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';

import '../../../application/blocs/super_admin/super_admin_bloc.dart';
import '../../../domain/entities/tenant.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';

class TenantsPage extends StatelessWidget {
  const TenantsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<SuperAdminBloc>()..add(const LoadTenants()),
      child: const _TenantsView(),
    );
  }
}

class _TenantsView extends StatefulWidget {
  const _TenantsView();

  @override
  State<_TenantsView> createState() => _TenantsViewState();
}

class _TenantsViewState extends State<_TenantsView> {
  String _search = '';

  Color _planColor(TenantPlan plan) {
    switch (plan) {
      case TenantPlan.trial:
        return AppColors.warning;
      case TenantPlan.basic:
        return AppColors.info;
      case TenantPlan.pro:
        return AppColors.success;
    }
  }

  Color _statusColor(TenantStatus status) {
    switch (status) {
      case TenantStatus.active:
        return AppColors.success;
      case TenantStatus.pending:
        return AppColors.warning;
      case TenantStatus.suspended:
        return AppColors.error;
      case TenantStatus.cancelled:
        return AppColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Tenants')),
      body: Column(
        children: [
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Buscar tenant...',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => _search = v.toLowerCase()),
            ),
          ),
          Expanded(
            child: BlocBuilder<SuperAdminBloc, SuperAdminState>(
              builder: (context, state) {
                if (state is SuperAdminLoading) {
                  return Shimmer.fromColors(
                    baseColor: Colors.grey.shade300,
                    highlightColor: Colors.grey.shade100,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: List.generate(
                        5,
                        (_) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Container(
                            height: 80,
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

                if (state is SuperAdminError) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline,
                            color: AppColors.error, size: 40),
                        const SizedBox(height: 12),
                        Text(
                          state.message,
                          style: const TextStyle(
                              color: AppColors.textMuted),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: () => context
                              .read<SuperAdminBloc>()
                              .add(const LoadTenants()),
                          icon: const Icon(Icons.refresh, size: 18),
                          label: const Text('Reintentar'),
                        ),
                      ],
                    ),
                  );
                }

                if (state is SuperAdminTenantsLoaded) {
                  var tenants = state.tenants.data;
                  if (_search.isNotEmpty) {
                    tenants = tenants
                        .where((t) =>
                            t.name.toLowerCase().contains(_search) ||
                            t.slug.toLowerCase().contains(_search))
                        .toList();
                  }

                  if (tenants.isEmpty) {
                    return const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.business,
                              size: 48, color: AppColors.textMuted),
                          SizedBox(height: 12),
                          Text(
                            'No se encontraron tenants',
                            style:
                                TextStyle(color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    );
                  }

                  return RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () async {
                      context
                          .read<SuperAdminBloc>()
                          .add(const LoadTenants());
                      await context
                          .read<SuperAdminBloc>()
                          .stream
                          .firstWhere(
                              (s) => s is! SuperAdminLoading);
                    },
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 4),
                      itemCount: tenants.length,
                      itemBuilder: (context, index) {
                        final tenant = tenants[index];
                        return Dismissible(
                          key: ValueKey(tenant.id),
                          background: Container(
                            alignment: Alignment.centerLeft,
                            padding:
                                const EdgeInsets.only(left: 20),
                            color: tenant.status ==
                                    TenantStatus.suspended
                                ? AppColors.success
                                : AppColors.error,
                            child: Icon(
                              tenant.status ==
                                      TenantStatus.suspended
                                  ? Icons.play_arrow
                                  : Icons.pause,
                              color: Colors.white,
                            ),
                          ),
                          secondaryBackground: Container(
                            alignment: Alignment.centerRight,
                            padding:
                                const EdgeInsets.only(right: 20),
                            color: tenant.status ==
                                    TenantStatus.suspended
                                ? AppColors.success
                                : AppColors.error,
                            child: Icon(
                              tenant.status ==
                                      TenantStatus.suspended
                                  ? Icons.play_arrow
                                  : Icons.pause,
                              color: Colors.white,
                            ),
                          ),
                          confirmDismiss: (_) async {
                            if (tenant.status ==
                                TenantStatus.suspended) {
                              context.read<SuperAdminBloc>().add(
                                  ActivateTenant(tenant.id));
                            } else {
                              context.read<SuperAdminBloc>().add(
                                  SuspendTenant(tenant.id));
                            }
                            return false;
                          },
                          child: Card(
                            margin:
                                const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor:
                                    AppColors.primaryMuted,
                                child: Text(
                                  tenant.name.isNotEmpty
                                      ? tenant.name[0]
                                          .toUpperCase()
                                      : '?',
                                  style: const TextStyle(
                                      color: AppColors.primary,
                                      fontWeight:
                                          FontWeight.w600),
                                ),
                              ),
                              title: Text(tenant.name),
                              subtitle: Text(
                                tenant.ownerName,
                                style: const TextStyle(
                                    fontSize: 12),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  _badge(
                                    tenant.plan.name,
                                    _planColor(tenant.plan),
                                  ),
                                  const SizedBox(width: 6),
                                  _badge(
                                    tenant.status.name,
                                    _statusColor(tenant.status),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  );
                }

                return const SizedBox.shrink();
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _badge(String label, Color color) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(30),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
