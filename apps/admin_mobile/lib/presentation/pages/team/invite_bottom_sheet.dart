import 'package:flutter/material.dart';

import '../../../domain/entities/user.dart';
import '../../../shared/constants/colors.dart';

class InviteBottomSheet extends StatefulWidget {
  final void Function(String email, UserRole role) onInvite;

  const InviteBottomSheet({super.key, required this.onInvite});

  @override
  State<InviteBottomSheet> createState() => _InviteBottomSheetState();
}

class _InviteBottomSheetState extends State<InviteBottomSheet> {
  final _emailController = TextEditingController();
  UserRole _selectedRole = UserRole.washer;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _emailController.text.isNotEmpty &&
      _emailController.text.contains('@');

  String _roleLabel(UserRole role) {
    switch (role) {
      case UserRole.tenantAdmin:
        return 'Admin';
      case UserRole.cashier:
        return 'Cajero';
      case UserRole.washer:
        return 'Lavador';
      case UserRole.client:
        return 'Cliente';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Invitar Miembro',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),

          // Email
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              hintText: 'correo@ejemplo.com',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),

          // Role selector
          const Text(
            'Rol',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              UserRole.tenantAdmin,
              UserRole.cashier,
              UserRole.washer,
              UserRole.client,
            ].map((role) {
              final isSelected = _selectedRole == role;
              return GestureDetector(
                onTap: () => setState(() => _selectedRole = role),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected
                          ? AppColors.primary
                          : AppColors.cardBorder,
                    ),
                  ),
                  child: Text(
                    _roleLabel(role),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.w400,
                      color: isSelected
                          ? Colors.white
                          : AppColors.textSecondary,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 20),

          // Submit
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _canSubmit
                  ? () {
                      widget.onInvite(
                          _emailController.text.trim(), _selectedRole);
                      Navigator.pop(context);
                    }
                  : null,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text(
                'Enviar invitacion',
                style: TextStyle(fontSize: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
