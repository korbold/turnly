import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../application/blocs/settings/settings_bloc.dart';
import '../../../../domain/entities/tenant.dart';
import '../../../../infrastructure/camera/camera_service.dart';
import '../../../../injection.dart';
import '../../../../shared/constants/colors.dart';

class GeneralTab extends StatelessWidget {
  const GeneralTab({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<SettingsBloc>()..add(const LoadSettings()),
      child: const _GeneralView(),
    );
  }
}

class _GeneralView extends StatefulWidget {
  const _GeneralView();

  @override
  State<_GeneralView> createState() => _GeneralViewState();
}

class _GeneralViewState extends State<_GeneralView> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _slotDurationCtrl = TextEditingController();
  final _cancelHoursCtrl = TextEditingController();
  final _instagramCtrl = TextEditingController();
  final _facebookCtrl = TextEditingController();
  final _whatsappCtrl = TextEditingController();
  BusinessType _businessType = BusinessType.carWash;
  File? _logoFile;
  File? _coverFile;
  bool _populated = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _addressCtrl.dispose();
    _phoneCtrl.dispose();
    _slotDurationCtrl.dispose();
    _cancelHoursCtrl.dispose();
    _instagramCtrl.dispose();
    _facebookCtrl.dispose();
    _whatsappCtrl.dispose();
    super.dispose();
  }

  void _populate(Map<String, dynamic> data) {
    if (_populated) return;
    _populated = true;
    _nameCtrl.text = data['name'] as String? ?? '';
    _descCtrl.text = data['description'] as String? ?? '';
    _addressCtrl.text = data['address'] as String? ?? '';
    _phoneCtrl.text = data['phone'] as String? ?? '';
    _slotDurationCtrl.text =
        (data['slot_duration_minutes'] ?? 30).toString();
    _cancelHoursCtrl.text =
        (data['cancellation_hours'] ?? 2).toString();
    _instagramCtrl.text = data['social_instagram'] as String? ?? '';
    _facebookCtrl.text = data['social_facebook'] as String? ?? '';
    _whatsappCtrl.text = data['social_whatsapp'] as String? ?? '';
    final bt = data['business_type'] as String?;
    if (bt != null) {
      try {
        _businessType = BusinessType.fromApi(bt);
      } catch (_) {}
    }
  }

  Future<void> _pickImage(bool isLogo) async {
    final cam = getIt<CameraService>();
    final file = await cam.pickImage(source: ImageSource.gallery);
    if (file != null && mounted) {
      setState(() {
        if (isLogo) {
          _logoFile = file;
        } else {
          _coverFile = file;
        }
      });
    }
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    context.read<SettingsBloc>().add(UpdateSettings({
          'name': _nameCtrl.text.trim(),
          'description': _descCtrl.text.trim(),
          'address': _addressCtrl.text.trim(),
          'phone': _phoneCtrl.text.trim(),
          'business_type': _businessType.apiValue,
          'slot_duration_minutes':
              int.tryParse(_slotDurationCtrl.text) ?? 30,
          'cancellation_hours':
              int.tryParse(_cancelHoursCtrl.text) ?? 2,
          'social_instagram': _instagramCtrl.text.trim(),
          'social_facebook': _facebookCtrl.text.trim(),
          'social_whatsapp': _whatsappCtrl.text.trim(),
        }));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('General')),
      body: BlocConsumer<SettingsBloc, SettingsState>(
        listener: (context, state) {
          if (state is SettingsLoaded) {
            _populate(state.data);
            if (_populated) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Guardado')),
              );
            }
          }
          if (state is SettingsError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: AppColors.error,
              ),
            );
          }
        },
        builder: (context, state) {
          if (state is SettingsLoading && !_populated) {
            return Shimmer.fromColors(
              baseColor: Colors.grey.shade300,
              highlightColor: Colors.grey.shade100,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: List.generate(
                  6,
                  (_) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Container(
                      height: 56,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }

          if (state is SettingsLoaded && !_populated) {
            _populate(state.data);
          }

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Image pickers
                Row(
                  children: [
                    _ImagePicker(
                      label: 'Logo',
                      file: _logoFile,
                      onTap: () => _pickImage(true),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _ImagePicker(
                        label: 'Portada',
                        file: _coverFile,
                        onTap: () => _pickImage(false),
                        isWide: true,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                TextFormField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Nombre'),
                  validator: (v) =>
                      (v == null || v.isEmpty) ? 'Requerido' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _descCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Descripcion'),
                  maxLines: 3,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _addressCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Direccion'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _phoneCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Telefono'),
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 12),

                DropdownButtonFormField<BusinessType>(
                  initialValue: _businessType,
                  decoration:
                      const InputDecoration(labelText: 'Tipo de negocio'),
                  items: BusinessType.values
                      .map((bt) => DropdownMenuItem(
                            value: bt,
                            child: Text(bt.apiValue.replaceAll('_', ' ')),
                          ))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) setState(() => _businessType = v);
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _slotDurationCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Duracion del slot (min)'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _cancelHoursCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Horas para cancelacion'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 24),

                Text('Redes sociales',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _instagramCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Instagram'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _facebookCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Facebook'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _whatsappCtrl,
                  decoration:
                      const InputDecoration(labelText: 'WhatsApp'),
                ),
                const SizedBox(height: 32),

                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: state is SettingsLoading ? null : _save,
                    child: state is SettingsLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Guardar'),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ImagePicker extends StatelessWidget {
  final String label;
  final File? file;
  final VoidCallback onTap;
  final bool isWide;

  const _ImagePicker({
    required this.label,
    required this.file,
    required this.onTap,
    this.isWide = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: isWide ? double.infinity : 80,
        height: 80,
        decoration: BoxDecoration(
          color: AppColors.primaryMuted,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
          image: file != null
              ? DecorationImage(
                  image: FileImage(file!),
                  fit: BoxFit.cover,
                )
              : null,
        ),
        child: file == null
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.add_a_photo,
                      color: AppColors.primary, size: 24),
                  const SizedBox(height: 4),
                  Text(
                    label,
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 11,
                    ),
                  ),
                ],
              )
            : null,
      ),
    );
  }
}
