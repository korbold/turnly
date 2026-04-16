import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../application/blocs/super_admin/super_admin_bloc.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';

class SuperAdminDashboard extends StatelessWidget {
  const SuperAdminDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<SuperAdminBloc>()..add(const LoadStats()),
      child: const _SuperAdminView(),
    );
  }
}

class _SuperAdminView extends StatelessWidget {
  const _SuperAdminView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  Text(
                    'Super Admin',
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontSize: 22),
                  ),
                  const Spacer(),
                ],
              ),
            ),
            Expanded(
              child: BlocBuilder<SuperAdminBloc, SuperAdminState>(
                builder: (context, state) {
                  if (state is SuperAdminLoading) {
                    return Shimmer.fromColors(
                      baseColor: Colors.grey.shade300,
                      highlightColor: Colors.grey.shade100,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: GridView.count(
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 1.4,
                          children: List.generate(
                            4,
                            (_) => Container(
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
                                .add(const LoadStats()),
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('Reintentar'),
                          ),
                        ],
                      ),
                    );
                  }

                  if (state is SuperAdminStatsLoaded) {
                    final stats = state.stats;
                    return RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () async {
                        context
                            .read<SuperAdminBloc>()
                            .add(const LoadStats());
                        await context
                            .read<SuperAdminBloc>()
                            .stream
                            .firstWhere(
                                (s) => s is! SuperAdminLoading);
                      },
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          GridView.count(
                            shrinkWrap: true,
                            physics:
                                const NeverScrollableScrollPhysics(),
                            crossAxisCount: 2,
                            mainAxisSpacing: 12,
                            crossAxisSpacing: 12,
                            childAspectRatio: 1.4,
                            children: [
                              _StatCard(
                                title: 'Total Tenants',
                                value: '${stats['total_tenants'] ?? 0}',
                                icon: Icons.business,
                                color: AppColors.primary,
                                trend: stats['tenants_trend'] as String?,
                              ),
                              _StatCard(
                                title: 'Activos',
                                value:
                                    '${stats['active_tenants'] ?? 0}',
                                icon: Icons.check_circle,
                                color: AppColors.success,
                                trend: null,
                              ),
                              _StatCard(
                                title: 'Usuarios',
                                value:
                                    '${stats['total_users'] ?? 0}',
                                icon: Icons.people,
                                color: AppColors.info,
                                trend: stats['users_trend'] as String?,
                              ),
                              _StatCard(
                                title: 'Reservaciones',
                                value:
                                    '${stats['total_reservations'] ?? 0}',
                                icon: Icons.calendar_month,
                                color: AppColors.warning,
                                trend: null,
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),

                          // Quick links
                          Card(
                            child: Column(
                              children: [
                                ListTile(
                                  leading: Container(
                                    width: 40,
                                    height: 40,
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryMuted,
                                      borderRadius:
                                          BorderRadius.circular(10),
                                    ),
                                    child: const Icon(Icons.business,
                                        color: AppColors.primary,
                                        size: 20),
                                  ),
                                  title: const Text('Gestionar Tenants'),
                                  trailing: const Icon(
                                      Icons.chevron_right,
                                      color: AppColors.textMuted),
                                  onTap: () =>
                                      context.push('/super-admin/tenants'),
                                ),
                                const Divider(height: 1),
                                ListTile(
                                  leading: Container(
                                    width: 40,
                                    height: 40,
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryMuted,
                                      borderRadius:
                                          BorderRadius.circular(10),
                                    ),
                                    child: const Icon(Icons.people,
                                        color: AppColors.primary,
                                        size: 20),
                                  ),
                                  title:
                                      const Text('Gestionar Usuarios'),
                                  trailing: const Icon(
                                      Icons.chevron_right,
                                      color: AppColors.textMuted),
                                  onTap: () =>
                                      context.push('/super-admin/users'),
                                ),
                              ],
                            ),
                          ),
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

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;
  final String? trend;

  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
    this.trend,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 20),
                const Spacer(),
                if (trend != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: trend!.startsWith('+')
                          ? AppColors.successMuted
                          : AppColors.errorMuted,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      trend!,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: trend!.startsWith('+')
                            ? AppColors.success
                            : AppColors.error,
                      ),
                    ),
                  ),
              ],
            ),
            const Spacer(),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              title,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
