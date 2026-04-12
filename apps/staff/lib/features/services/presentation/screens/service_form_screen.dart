import 'package:flutter/material.dart';
import '../../domain/entities/service.dart';
import '../../infrastructure/service_repository_impl.dart';

class ServiceFormScreen extends StatefulWidget {
  final Service? service;

  const ServiceFormScreen({super.key, this.service});

  @override
  State<ServiceFormScreen> createState() => _ServiceFormScreenState();
}

class _ServiceFormScreenState extends State<ServiceFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _repo = ServiceRepositoryImpl();

  late final TextEditingController _nameController;
  late final TextEditingController _priceController;
  late final TextEditingController _durationController;
  late final TextEditingController _descriptionController;
  bool _isActive = true;
  bool _saving = false;

  bool get _isEdit => widget.service != null;

  @override
  void initState() {
    super.initState();
    final s = widget.service;
    _nameController = TextEditingController(text: s?.name ?? '');
    _priceController = TextEditingController(text: s != null ? s.price.toStringAsFixed(2) : '');
    _durationController = TextEditingController(text: s != null ? '${s.durationMinutes}' : '');
    _descriptionController = TextEditingController(text: s?.description ?? '');
    _isActive = s?.isActive ?? true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    _durationController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final name = _nameController.text.trim();
    final price = double.parse(_priceController.text.trim());
    final duration = int.parse(_durationController.text.trim());
    final description = _descriptionController.text.trim();

    if (_isEdit) {
      final result = await _repo.update(
        widget.service!.id,
        name: name,
        price: price,
        durationMinutes: duration,
        description: description.isNotEmpty ? description : null,
        isActive: _isActive,
      );
      if (!mounted) return;
      result.fold(
        (f) {
          setState(() => _saving = false);
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message)));
        },
        (_) => Navigator.pop(context, true),
      );
    } else {
      final result = await _repo.create(
        name: name,
        price: price,
        durationMinutes: duration,
        description: description.isNotEmpty ? description : null,
      );
      if (!mounted) return;
      result.fold(
        (f) {
          setState(() => _saving = false);
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message)));
        },
        (_) => Navigator.pop(context, true),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Editar servicio' : 'Nuevo servicio'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Nombre *',
                hintText: 'Ej. Lavado básico',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.words,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'El nombre es obligatorio' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _priceController,
              decoration: const InputDecoration(
                labelText: 'Precio *',
                hintText: '0.00',
                prefixText: '\$ ',
                border: OutlineInputBorder(),
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'El precio es obligatorio';
                final parsed = double.tryParse(v.trim());
                if (parsed == null || parsed < 0) return 'Ingresa un precio válido';
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _durationController,
              decoration: const InputDecoration(
                labelText: 'Duración (minutos) *',
                hintText: '30',
                suffixText: 'min',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'La duración es obligatoria';
                final parsed = int.tryParse(v.trim());
                if (parsed == null || parsed <= 0) return 'Ingresa una duración válida';
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Descripción (opcional)',
                hintText: 'Describe el servicio',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
            if (_isEdit) ...[
              const SizedBox(height: 16),
              SwitchListTile(
                title: const Text('Servicio activo'),
                subtitle: Text(_isActive ? 'Visible para los clientes' : 'No visible para los clientes'),
                value: _isActive,
                onChanged: (v) => setState(() => _isActive = v),
              ),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _submit,
              child: _saving
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_isEdit ? 'Guardar cambios' : 'Crear servicio'),
            ),
          ],
        ),
      ),
    );
  }
}
