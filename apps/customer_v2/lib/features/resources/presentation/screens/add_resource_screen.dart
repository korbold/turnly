// lib/features/resources/presentation/screens/add_resource_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../domain/repositories/resource_repository.dart';
import '../cubit/resources_cubit.dart';

class AddResourceScreen extends StatelessWidget {
  const AddResourceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => ResourcesCubit(getIt<ResourceRepository>()),
      child: const _AddResourceView(),
    );
  }
}

class _AddResourceView extends StatefulWidget {
  const _AddResourceView();

  @override
  State<_AddResourceView> createState() => _AddResourceViewState();
}

class _AddResourceViewState extends State<_AddResourceView> {
  final _formKey = GlobalKey<FormState>();
  final _labelController = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _labelController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);

    final success = await context.read<ResourcesCubit>().createResource(
          label: _labelController.text.trim(),
        );

    if (!mounted) return;
    setState(() => _saving = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Registro creado exitosamente'),
          backgroundColor: AppColors.success,
        ),
      );
      context.pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Error al crear registro'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Nuevo Registro',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Crea un nuevo registro',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ).animate().fadeIn(duration: 400.ms),
              const SizedBox(height: 4),
              const Text(
                'Este registro sera utilizado al crear reservas',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ).animate().fadeIn(duration: 400.ms, delay: 50.ms),
              const SizedBox(height: 32),

              // Icon
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.accentLight,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    Icons.badge_outlined,
                    color: AppColors.accent,
                    size: 36,
                  ),
                ),
              ).animate().fadeIn(duration: 400.ms, delay: 100.ms).scale(
                    begin: const Offset(0.8, 0.8),
                    end: const Offset(1, 1),
                    duration: 400.ms,
                    delay: 100.ms,
                  ),

              const SizedBox(height: 32),

              AppTextField(
                label: 'Nombre del registro',
                hint: 'Ej: Mi vehiculo, Placa ABC-123',
                controller: _labelController,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'El nombre es requerido';
                  }
                  return null;
                },
              ).animate().fadeIn(duration: 400.ms, delay: 150.ms),

              const SizedBox(height: 40),

              AppButton(
                label: 'Guardar Registro',
                onPressed: _save,
                isLoading: _saving,
                icon: Icons.save_rounded,
              ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
            ],
          ),
        ),
      ),
    );
  }
}
