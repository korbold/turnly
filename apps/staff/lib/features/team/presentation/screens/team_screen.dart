import 'package:flutter/material.dart';
import '../../../../shared/enums/user_role.dart';
import '../../domain/entities/team_member.dart';
import '../../infrastructure/team_repository_impl.dart';

class TeamScreen extends StatefulWidget {
  const TeamScreen({super.key});

  @override
  State<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends State<TeamScreen> {
  final _repo = TeamRepositoryImpl();
  List<TeamMember> _members = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await _repo.getAll();
    if (!mounted) return;
    setState(() {
      _loading = false;
      result.fold(
        (f) => _error = f.message,
        (list) => _members = list,
      );
    });
  }

  Future<void> _showRoleDialog(TeamMember member) async {
    final selected = await showDialog<UserRole>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: Text('Cambiar rol de ${member.name}'),
        children: UserRole.values.map((role) {
          final isCurrent = role == member.role;
          return SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, role),
            child: Row(
              children: [
                Container(
                  width: 12,
                  height: 12,
                  margin: const EdgeInsets.only(right: 12),
                  decoration: BoxDecoration(
                    color: role.color,
                    shape: BoxShape.circle,
                  ),
                ),
                Expanded(child: Text(role.label, style: TextStyle(fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal))),
                if (isCurrent) const Icon(Icons.check, size: 18, color: Colors.blue),
              ],
            ),
          );
        }).toList(),
      ),
    );

    if (selected == null || selected == member.role || !mounted) return;

    final result = await _repo.updateRole(member.id, selected);
    if (!mounted) return;
    result.fold(
      (f) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message))),
      (_) => _loadData(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Equipo'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _loadData, child: const Text('Reintentar')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: _members.isEmpty
                      ? ListView(
                          children: [
                            SizedBox(
                              height: 300,
                              child: Center(
                                child: Text(
                                  'No hay miembros en el equipo',
                                  style: TextStyle(color: Colors.grey.shade600),
                                ),
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                          itemCount: _members.length,
                          itemBuilder: (context, index) {
                            final member = _members[index];
                            return _TeamMemberCard(
                              member: member,
                              onTap: () => _showRoleDialog(member),
                            );
                          },
                        ),
                ),
    );
  }
}

class _TeamMemberCard extends StatelessWidget {
  final TeamMember member;
  final VoidCallback onTap;

  const _TeamMemberCard({required this.member, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: member.role.color.withValues(alpha: 0.15),
          child: Text(
            member.name.isNotEmpty ? member.name[0].toUpperCase() : '?',
            style: TextStyle(color: member.role.color, fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(member.name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(member.email, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            if (member.phone != null) ...[
              const SizedBox(height: 2),
              Text(member.phone!, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            ],
          ],
        ),
        isThreeLine: member.phone != null,
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: member.role.color.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            member.role.label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: member.role.color,
            ),
          ),
        ),
        onTap: onTap,
      ),
    );
  }
}
