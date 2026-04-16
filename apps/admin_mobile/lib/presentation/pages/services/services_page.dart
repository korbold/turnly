import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../application/blocs/services/services_bloc.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';
import 'widgets/service_card.dart';

class ServicesPage extends StatelessWidget {
  const ServicesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<ServicesBloc>()..add(const LoadServices()),
      child: const _ServicesView(),
    );
  }
}

class _ServicesView extends StatelessWidget {
  const _ServicesView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  Text(
                    'Servicios',
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontSize: 22),
                  ),
                  const Spacer(),
                ],
              ),
            ),

            // Content
            Expanded(
              child: BlocBuilder<ServicesBloc, ServicesState>(
                builder: (context, state) {
                  if (state is ServicesLoading) {
                    return const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                      ),
                    );
                  }

                  if (state is ServicesError) {
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
                            onPressed: () => context
                                .read<ServicesBloc>()
                                .add(const LoadServices()),
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('Reintentar'),
                          ),
                        ],
                      ),
                    );
                  }

                  if (state is ServicesLoaded) {
                    final services = state.result.data;
                    return RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () async {
                        context
                            .read<ServicesBloc>()
                            .add(const LoadServices());
                        await context
                            .read<ServicesBloc>()
                            .stream
                            .firstWhere((s) => s is! ServicesLoading);
                      },
                      child: services.isEmpty
                          ? ListView(
                              children: [
                                SizedBox(
                                  height:
                                      MediaQuery.of(context).size.height *
                                          0.4,
                                  child: const Center(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.local_car_wash,
                                            size: 48,
                                            color: AppColors.textMuted),
                                        SizedBox(height: 12),
                                        Text(
                                          'Sin servicios configurados',
                                          style: TextStyle(
                                              color: AppColors.textMuted),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : GridView.builder(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 4),
                              gridDelegate:
                                  const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                mainAxisSpacing: 12,
                                crossAxisSpacing: 12,
                                childAspectRatio: 0.72,
                              ),
                              itemCount: services.length,
                              itemBuilder: (context, index) {
                                final service = services[index];
                                return ServiceCard(
                                  service: service,
                                  onTap: () async {
                                    await context.push('/services/create',
                                        extra: service);
                                    if (context.mounted) {
                                      context
                                          .read<ServicesBloc>()
                                          .add(const LoadServices());
                                    }
                                  },
                                  onLongPress: () {
                                    context.read<ServicesBloc>().add(
                                          UpdateService(
                                            id: service.id,
                                            isActive: !service.isActive,
                                          ),
                                        );
                                  },
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
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await context.push('/services/create');
          if (context.mounted) {
            context.read<ServicesBloc>().add(const LoadServices());
          }
        },
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}
