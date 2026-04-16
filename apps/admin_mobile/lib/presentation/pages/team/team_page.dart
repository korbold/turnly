import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../application/blocs/team/team_bloc.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';
import 'invite_bottom_sheet.dart';
import 'widgets/staff_card.dart';

class TeamPage extends StatelessWidget {
  const TeamPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<TeamBloc>()..add(const LoadTeam()),
      child: const _TeamView(),
    );
  }
}

class _TeamView extends StatelessWidget {
  const _TeamView();

  void _showInvite(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => InviteBottomSheet(
        onInvite: (email, role) {
          context.read<TeamBloc>().add(InviteUser(email: email, role: role));
        },
      ),
    );
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
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  Text(
                    'Equipo',
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
              child: BlocBuilder<TeamBloc, TeamState>(
                builder: (context, state) {
                  if (state is TeamLoading) {
                    return const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                      ),
                    );
                  }

                  if (state is TeamError) {
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
                                .read<TeamBloc>()
                                .add(const LoadTeam()),
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('Reintentar'),
                          ),
                        ],
                      ),
                    );
                  }

                  if (state is TeamLoaded) {
                    final members = state.result.data;
                    return RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () async {
                        context.read<TeamBloc>().add(const LoadTeam());
                        await context
                            .read<TeamBloc>()
                            .stream
                            .firstWhere((s) => s is! TeamLoading);
                      },
                      child: members.isEmpty
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
                                        Icon(Icons.group,
                                            size: 48,
                                            color: AppColors.textMuted),
                                        SizedBox(height: 12),
                                        Text(
                                          'Sin miembros del equipo',
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
                              itemCount: members.length,
                              itemBuilder: (context, index) {
                                final user = members[index];
                                return StaffCard(
                                  user: user,
                                  onRoleChanged: (role) {
                                    context.read<TeamBloc>().add(
                                          ChangeRole(
                                              userId: user.id, role: role),
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
        onPressed: () => _showInvite(context),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.person_add, color: Colors.white),
      ),
    );
  }
}
