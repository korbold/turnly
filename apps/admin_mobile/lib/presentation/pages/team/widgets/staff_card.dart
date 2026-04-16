import 'package:flutter/material.dart';

import '../../../../domain/entities/user.dart';
import '../../../../shared/constants/colors.dart';

class StaffCard extends StatelessWidget {
  final User user;
  final ValueChanged<UserRole>? onRoleChanged;

  const StaffCard({
    super.key,
    required this.user,
    this.onRoleChanged,
  });

  String _initials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  String _roleLabel(UserRole? role) {
    switch (role) {
      case UserRole.tenantAdmin:
        return 'Admin';
      case UserRole.cashier:
        return 'Cajero';
      case UserRole.washer:
        return 'Lavador';
      case UserRole.client:
        return 'Cliente';
      case null:
        return 'Sin rol';
    }
  }

  Color _roleColor(UserRole? role) {
    switch (role) {
      case UserRole.tenantAdmin:
        return AppColors.primary;
      case UserRole.cashier:
        return AppColors.success;
      case UserRole.washer:
        return AppColors.info;
      case UserRole.client:
        return AppColors.textMuted;
      case null:
        return AppColors.textMuted;
    }
  }

  void _showRoleSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Cambiar rol de ${user.name}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                UserRole.tenantAdmin,
                UserRole.cashier,
                UserRole.washer,
                UserRole.client,
              ].map((role) {
                final isSelected = user.role == role;
                final color = _roleColor(role);
                return GestureDetector(
                  onTap: () {
                    Navigator.pop(ctx);
                    if (!isSelected && onRoleChanged != null) {
                      onRoleChanged!(role);
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? color.withValues(alpha: 0.15)
                          : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected ? color : AppColors.cardBorder,
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: Text(
                      _roleLabel(role),
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.w400,
                        color: isSelected ? color : AppColors.textSecondary,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final roleColor = _roleColor(user.role);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        children: [
          // Avatar
          CircleAvatar(
            radius: 22,
            backgroundColor: AppColors.primaryMuted,
            child: Text(
              _initials(user.name),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.name,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  user.email,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),

          // Role chip
          GestureDetector(
            onTap: () => _showRoleSheet(context),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: roleColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _roleLabel(user.role),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: roleColor,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
