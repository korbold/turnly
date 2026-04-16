import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../application/use_cases/clients/create_client_use_case.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';

class CreateClientPage extends StatefulWidget {
  const CreateClientPage({super.key});

  @override
  State<CreateClientPage> createState() => _CreateClientPageState();
}

class _CreateClientPageState extends State<CreateClientPage> {
  final _formKey = GlobalKey<FormState>();
  final _plateController = TextEditingController();
  final _brandController = TextEditingController();
  final _modelController = TextEditingController();
  final _colorController = TextEditingController();
  String _type = 'sedan';
  bool _submitting = false;

  final _vehicleTypes = [
    'sedan',
    'suv',
    'pickup',
    'hatchback',
    'van',
    'truck',
    'motorcycle',
    'other',
  ];

  @override
  void dispose() {
    _plateController.dispose();
    _brandController.dispose();
    _modelController.dispose();
    _colorController.dispose();
    super.dispose();
  }

  bool get _canSubmit => _plateController.text.isNotEmpty;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      await getIt<CreateClientUseCase>().call(
        plate: _plateController.text.trim().isNotEmpty
            ? _plateController.text.trim()
            : null,
        brand: _brandController.text.trim().isNotEmpty
            ? _brandController.text.trim()
            : null,
        model: _modelController.text.trim().isNotEmpty
            ? _modelController.text.trim()
            : null,
        color: _colorController.text.trim().isNotEmpty
            ? _colorController.text.trim()
            : null,
        type: _type,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cliente creado exitosamente'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Nuevo Cliente'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Plate
            const Text(
              'Placa',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _plateController,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                hintText: 'Ej: ABC-1234',
                prefixIcon: Icon(Icons.directions_car),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 20),

            // Brand
            const Text(
              'Marca',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _brandController,
              decoration: const InputDecoration(
                hintText: 'Ej: Toyota',
              ),
            ),
            const SizedBox(height: 20),

            // Model
            const Text(
              'Modelo',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _modelController,
              decoration: const InputDecoration(
                hintText: 'Ej: Corolla',
              ),
            ),
            const SizedBox(height: 20),

            // Color
            const Text(
              'Color',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _colorController,
              decoration: const InputDecoration(
                hintText: 'Ej: Blanco',
              ),
            ),
            const SizedBox(height: 20),

            // Type
            const Text(
              'Tipo de Vehiculo',
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
              children: _vehicleTypes.map((type) {
                final isSelected = _type == type;
                return GestureDetector(
                  onTap: () => setState(() => _type = type),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.primary
                          : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected
                            ? AppColors.primary
                            : AppColors.cardBorder,
                      ),
                    ),
                    child: Text(
                      type[0].toUpperCase() + type.substring(1),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.w400,
                        color:
                            isSelected ? Colors.white : AppColors.textSecondary,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 32),

            // Submit
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _canSubmit && !_submitting ? _submit : null,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Crear Cliente',
                        style: TextStyle(fontSize: 16),
                      ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}
