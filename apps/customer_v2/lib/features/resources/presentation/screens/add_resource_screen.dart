// lib/features/resources/presentation/screens/add_resource_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/tenant_theme.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../domain/entities/client_resource.dart';
import '../../domain/repositories/resource_repository.dart';
import '../cubit/resources_cubit.dart';

class AddResourceScreen extends StatelessWidget {
  final List<Map<String, dynamic>> customFields;
  final ClientResource? existingResource;
  final String? businessType;

  const AddResourceScreen({
    super.key,
    this.customFields = const [],
    this.existingResource,
    this.businessType,
  });

  @override
  Widget build(BuildContext context) {
    final tenantTheme = TenantTheme.fromBusinessType(businessType);
    return Theme(
      data: Theme.of(context).copyWith(
        colorScheme: Theme.of(context).colorScheme.copyWith(
          primary: tenantTheme.primary,
          secondary: tenantTheme.secondary,
        ),
      ),
      child: BlocProvider(
        create: (_) => ResourcesCubit(getIt<ResourceRepository>()),
        child: _AddResourceView(
          customFields: customFields,
          existingResource: existingResource,
        ),
      ),
    );
  }
}

class _AddResourceView extends StatefulWidget {
  final List<Map<String, dynamic>> customFields;
  final ClientResource? existingResource;

  const _AddResourceView({
    required this.customFields,
    this.existingResource,
  });

  @override
  State<_AddResourceView> createState() => _AddResourceViewState();
}

class _AddResourceViewState extends State<_AddResourceView> {
  final _formKey = GlobalKey<FormState>();
  final _labelController = TextEditingController();
  final Map<String, TextEditingController> _customFieldControllers = {};
  bool _saving = false;

  bool get _isEditing => widget.existingResource != null;

  @override
  void initState() {
    super.initState();
    for (final field in widget.customFields) {
      final key = field['key'] as String? ?? '';
      if (key.isNotEmpty) {
        _customFieldControllers[key] = TextEditingController();
      }
    }

    // Pre-fill if editing
    if (_isEditing) {
      final data = widget.existingResource!.data;
      if (data != null && widget.customFields.isNotEmpty) {
        for (final field in widget.customFields) {
          final key = field['key'] as String? ?? '';
          if (key.isNotEmpty && data.containsKey(key)) {
            _customFieldControllers[key]?.text = data[key]?.toString() ?? '';
          }
        }
      } else {
        _labelController.text = widget.existingResource!.label;
      }
    }
  }

  @override
  void dispose() {
    _labelController.dispose();
    for (final c in _customFieldControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);

    String label;
    Map<String, dynamic>? data;

    if (widget.customFields.isNotEmpty) {
      data = {};
      for (final field in widget.customFields) {
        final key = field['key'] as String? ?? '';
        if (key.isNotEmpty) {
          data[key] = _customFieldControllers[key]?.text.trim() ?? '';
        }
      }

      final parts = <String>[];
      for (final key in ['plate', 'brand', 'model']) {
        final val = _customFieldControllers[key]?.text.trim() ?? '';
        if (val.isNotEmpty) parts.add(val);
      }
      if (parts.isEmpty) {
        final firstKey = widget.customFields.first['key'] as String? ?? '';
        label = _customFieldControllers[firstKey]?.text.trim() ?? '';
      } else {
        label = parts.join(' ');
      }
    } else {
      label = _labelController.text.trim();
    }

    if (label.isEmpty) {
      setState(() => _saving = false);
      return;
    }

    bool success;
    if (_isEditing) {
      success = await context.read<ResourcesCubit>().updateResource(
            id: widget.existingResource!.id,
            data: data,
          );
    } else {
      success = await context.read<ResourcesCubit>().createResource(
            label: label,
            data: data,
          );
    }

    if (!mounted) return;
    setState(() => _saving = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isEditing ? 'Registro actualizado' : 'Registro creado exitosamente'),
          backgroundColor: AppColors.success,
        ),
      );
      context.pop(true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Error al guardar registro'),
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
        title: Text(
          _isEditing ? 'Editar Registro' : 'Nuevo Registro',
          style: const TextStyle(
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
              Text(
                _isEditing ? 'Edita tu registro' : 'Crea un nuevo registro',
                style: const TextStyle(
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
                  child: Icon(
                    _isEditing ? Icons.edit_outlined : Icons.badge_outlined,
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

              if (widget.customFields.isNotEmpty)
                ...widget.customFields.asMap().entries.map((entry) {
                  final i = entry.key;
                  final field = entry.value;
                  final key = field['key'] as String? ?? '';
                  final fieldLabel = field['label'] as String? ?? key;
                  final isRequired = field['required'] as bool? ?? false;
                  final capitalize = field['capitalize'] as String?;

                  TextCapitalization textCap = TextCapitalization.none;
                  List<TextInputFormatter>? formatters;

                  if (capitalize == 'uppercase') {
                    textCap = TextCapitalization.characters;
                    formatters = [_UpperCaseFormatter()];
                  } else if (capitalize == 'capitalize') {
                    textCap = TextCapitalization.words;
                  } else if (capitalize == 'lowercase') {
                    formatters = [_LowerCaseFormatter()];
                  }

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: AppTextField(
                      label: '$fieldLabel${isRequired ? ' *' : ''}',
                      hint: fieldLabel,
                      controller: _customFieldControllers[key],
                      textCapitalization: textCap,
                      inputFormatters: formatters,
                      validator: isRequired
                          ? (value) {
                              if (value == null || value.trim().isEmpty) {
                                return '$fieldLabel es requerido';
                              }
                              return null;
                            }
                          : null,
                    ),
                  ).animate().fadeIn(duration: 400.ms, delay: (150 + i * 50).ms);
                })
              else
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
                label: _isEditing ? 'Guardar Cambios' : 'Guardar Registro',
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

class _UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return newValue.copyWith(
      text: newValue.text.toUpperCase(),
      selection: newValue.selection,
    );
  }
}

class _LowerCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return newValue.copyWith(
      text: newValue.text.toLowerCase(),
      selection: newValue.selection,
    );
  }
}
