import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../application/blocs/services/services_bloc.dart';
import '../../../domain/entities/service.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';

class CreateServicePage extends StatefulWidget {
  final Service? editService;

  const CreateServicePage({super.key, this.editService});

  @override
  State<CreateServicePage> createState() => _CreateServicePageState();
}

class _CreateServicePageState extends State<CreateServicePage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _priceController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _imageUrlController;
  late bool _isActive;
  bool _submitting = false;

  bool get _isEditing => widget.editService != null;

  @override
  void initState() {
    super.initState();
    _nameController =
        TextEditingController(text: widget.editService?.name ?? '');
    _priceController = TextEditingController(
        text: widget.editService?.price.toStringAsFixed(2) ?? '');
    _descriptionController =
        TextEditingController(text: widget.editService?.description ?? '');
    _imageUrlController =
        TextEditingController(text: widget.editService?.imageUrl ?? '');
    _isActive = widget.editService?.isActive ?? true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    _descriptionController.dispose();
    _imageUrlController.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _nameController.text.isNotEmpty && _priceController.text.isNotEmpty;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    final bloc = getIt<ServicesBloc>();
    try {
      if (_isEditing) {
        bloc.add(UpdateService(
          id: widget.editService!.id,
          name: _nameController.text.trim(),
          price: double.tryParse(_priceController.text),
          description: _descriptionController.text.trim().isNotEmpty
              ? _descriptionController.text.trim()
              : null,
          imageUrl: _imageUrlController.text.trim().isNotEmpty
              ? _imageUrlController.text.trim()
              : null,
          isActive: _isActive,
        ));
      } else {
        bloc.add(CreateService(
          name: _nameController.text.trim(),
          price: double.tryParse(_priceController.text) ?? 0,
          description: _descriptionController.text.trim().isNotEmpty
              ? _descriptionController.text.trim()
              : null,
          imageUrl: _imageUrlController.text.trim().isNotEmpty
              ? _imageUrlController.text.trim()
              : null,
          isActive: _isActive,
        ));
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content:
                Text(_isEditing ? 'Servicio actualizado' : 'Servicio creado'),
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
        title: Text(_isEditing ? 'Editar Servicio' : 'Nuevo Servicio'),
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
            // Image preview
            if (_imageUrlController.text.isNotEmpty) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  _imageUrlController.text,
                  height: 160,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => Container(
                    height: 160,
                    decoration: BoxDecoration(
                      color: AppColors.primaryMuted,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Center(
                      child: Icon(Icons.broken_image,
                          color: AppColors.textMuted, size: 40),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Name
            _FieldLabel('Nombre'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(
                hintText: 'Ej: Lavado Completo',
              ),
              validator: (v) =>
                  v == null || v.isEmpty ? 'El nombre es requerido' : null,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 20),

            // Price
            _FieldLabel('Precio'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _priceController,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                prefixText: '\$ ',
                hintText: '0.00',
              ),
              validator: (v) =>
                  v == null || v.isEmpty ? 'El precio es requerido' : null,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 20),

            // Description
            _FieldLabel('Descripcion (opcional)'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _descriptionController,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Describe el servicio...',
              ),
            ),
            const SizedBox(height: 20),

            // Image URL
            _FieldLabel('URL de Imagen (opcional)'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _imageUrlController,
              decoration: const InputDecoration(
                hintText: 'https://...',
                prefixIcon: Icon(Icons.image),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 20),

            // Active switch
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.cardBorder),
              ),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Servicio activo',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  Switch(
                    value: _isActive,
                    activeTrackColor: AppColors.primary,
                    onChanged: (v) => setState(() => _isActive = v),
                  ),
                ],
              ),
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
                    : Text(
                        _isEditing ? 'Guardar Cambios' : 'Crear Servicio',
                        style: const TextStyle(fontSize: 16),
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

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
    );
  }
}
