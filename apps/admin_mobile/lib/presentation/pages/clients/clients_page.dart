import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../application/blocs/clients/clients_bloc.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';
import 'widgets/client_card.dart';

class ClientsPage extends StatelessWidget {
  const ClientsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<ClientsBloc>(),
      child: const _ClientsView(),
    );
  }
}

class _ClientsView extends StatefulWidget {
  const _ClientsView();

  @override
  State<_ClientsView> createState() => _ClientsViewState();
}

class _ClientsViewState extends State<_ClientsView> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _load({String? search}) {
    context.read<ClientsBloc>().add(LoadClients(search: search));
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _load(search: value.isEmpty ? null : value);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Text(
                    'Clientes',
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontSize: 22),
                  ),
                  const Spacer(),
                ],
              ),
            ),

            // Search bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Buscar por placa, nombre...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            _load();
                          },
                        )
                      : null,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.cardBorder),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.cardBorder),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ),
                onChanged: _onSearchChanged,
              ),
            ),

            // Content
            Expanded(
              child: BlocBuilder<ClientsBloc, ClientsState>(
                builder: (context, state) {
                  if (state is ClientsLoading) {
                    return const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                      ),
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
                            style:
                                const TextStyle(color: AppColors.textMuted),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: () => _load(),
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('Reintentar'),
                          ),
                        ],
                      ),
                    );
                  }

                  if (state is ClientsLoaded) {
                    final clients = state.result.data;
                    return RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () async {
                        _load(
                          search: _searchController.text.isEmpty
                              ? null
                              : _searchController.text,
                        );
                        await context
                            .read<ClientsBloc>()
                            .stream
                            .firstWhere((s) => s is! ClientsLoading);
                      },
                      child: clients.isEmpty
                          ? ListView(
                              children: [
                                SizedBox(
                                  height:
                                      MediaQuery.of(context).size.height * 0.4,
                                  child: const Center(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.people_outline,
                                            size: 48,
                                            color: AppColors.textMuted),
                                        SizedBox(height: 12),
                                        Text(
                                          'Sin clientes encontrados',
                                          style: TextStyle(
                                              color: AppColors.textMuted),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 4),
                              itemCount: clients.length,
                              itemBuilder: (context, index) {
                                final client = clients[index];
                                return ClientCard(
                                  client: client,
                                  onTap: () =>
                                      context.push('/clients/${client.id}'),
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
          await context.push('/clients/create');
          if (mounted) _load();
        },
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}
