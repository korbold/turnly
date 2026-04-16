import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';

import '../../../application/blocs/super_admin/super_admin_bloc.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';

class SuperAdminUsersPage extends StatelessWidget {
  const SuperAdminUsersPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<SuperAdminBloc>()..add(const LoadUsers()),
      child: const _UsersView(),
    );
  }
}

class _UsersView extends StatefulWidget {
  const _UsersView();

  @override
  State<_UsersView> createState() => _UsersViewState();
}

class _UsersViewState extends State<_UsersView> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Usuarios')),
      body: Column(
        children: [
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Buscar usuario...',
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
                        6,
                        (_) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Container(
                            height: 72,
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
                              .add(const LoadUsers()),
                          icon: const Icon(Icons.refresh, size: 18),
                          label: const Text('Reintentar'),
                        ),
                      ],
                    ),
                  );
                }

                if (state is SuperAdminUsersLoaded) {
                  var users = state.users.data;
                  if (_search.isNotEmpty) {
                    users = users
                        .where((u) =>
                            u.name
                                .toLowerCase()
                                .contains(_search) ||
                            u.email
                                .toLowerCase()
                                .contains(_search))
                        .toList();
                  }

                  if (users.isEmpty) {
                    return const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.people,
                              size: 48, color: AppColors.textMuted),
                          SizedBox(height: 12),
                          Text(
                            'No se encontraron usuarios',
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
                          .add(const LoadUsers());
                      await context
                          .read<SuperAdminBloc>()
                          .stream
                          .firstWhere(
                              (s) => s is! SuperAdminLoading);
                    },
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 4),
                      itemCount: users.length,
                      itemBuilder: (context, index) {
                        final user = users[index];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: Hero(
                              tag: 'user_avatar_${user.id}',
                              child: CircleAvatar(
                                backgroundColor:
                                    AppColors.primaryMuted,
                                child: Text(
                                  user.name.isNotEmpty
                                      ? user.name[0].toUpperCase()
                                      : '?',
                                  style: const TextStyle(
                                      color: AppColors.primary,
                                      fontWeight:
                                          FontWeight.w600),
                                ),
                              ),
                            ),
                            title: Text(user.name),
                            subtitle: Text(
                              user.email,
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: user.role != null
                                ? Container(
                                    padding:
                                        const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryMuted,
                                      borderRadius:
                                          BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      user.role!.apiValue
                                          .replaceAll('_', ' '),
                                      style: const TextStyle(
                                        color: AppColors.primary,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  )
                                : null,
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
}
