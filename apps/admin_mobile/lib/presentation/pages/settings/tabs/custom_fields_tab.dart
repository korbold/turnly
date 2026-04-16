import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../application/blocs/settings/settings_bloc.dart';
import '../../../../injection.dart';
import '../../../../shared/constants/colors.dart';

class _CustomField {
  String name;
  String type;
  bool required;

  _CustomField({
    required this.name,
    required this.type,
    this.required = false,
  });
}

const _fieldTypes = ['text', 'number', 'email', 'phone', 'select', 'date'];

class CustomFieldsTab extends StatelessWidget {
  const CustomFieldsTab({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<SettingsBloc>()..add(const LoadSettings()),
      child: const _CustomFieldsView(),
    );
  }
}

class _CustomFieldsView extends StatefulWidget {
  const _CustomFieldsView();

  @override
  State<_CustomFieldsView> createState() => _CustomFieldsViewState();
}

class _CustomFieldsViewState extends State<_CustomFieldsView> {
  final List<_CustomField> _fields = [];
  bool _populated = false;

  void _populate(Map<String, dynamic> data) {
    if (_populated) return;
    _populated = true;
    final raw = data['custom_fields'] as List<dynamic>? ?? [];
    for (final f in raw) {
      if (f is Map<String, dynamic>) {
        _fields.add(_CustomField(
          name: f['name'] as String? ?? '',
          type: f['type'] as String? ?? 'text',
          required: f['required'] as bool? ?? false,
        ));
      }
    }
  }

  void _addField() {
    final nameCtrl = TextEditingController();
    String selectedType = 'text';
    bool isRequired = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Nuevo campo'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration:
                    const InputDecoration(labelText: 'Nombre del campo'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: selectedType,
                decoration: const InputDecoration(labelText: 'Tipo'),
                items: _fieldTypes
                    .map((t) =>
                        DropdownMenuItem(value: t, child: Text(t)))
                    .toList(),
                onChanged: (v) {
                  if (v != null) {
                    setDialogState(() => selectedType = v);
                  }
                },
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                title: const Text('Requerido'),
                value: isRequired,
                onChanged: (v) =>
                    setDialogState(() => isRequired = v),
                contentPadding: EdgeInsets.zero,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                if (nameCtrl.text.trim().isNotEmpty) {
                  Navigator.pop(ctx);
                  setState(() {
                    _fields.add(_CustomField(
                      name: nameCtrl.text.trim(),
                      type: selectedType,
                      required: isRequired,
                    ));
                  });
                }
              },
              child: const Text('Agregar'),
            ),
          ],
        ),
      ),
    ).then((_) => nameCtrl.dispose());
  }

  void _confirmDelete(int index) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar campo'),
        content: Text(
            'Seguro que deseas eliminar "${_fields[index].name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _fields.removeAt(index));
            },
            style: FilledButton.styleFrom(
                backgroundColor: AppColors.error),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Campos Personalizados')),
      body: BlocConsumer<SettingsBloc, SettingsState>(
        listener: (context, state) {
          if (state is SettingsLoaded) _populate(state.data);
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
                  4,
                  (_) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Container(
                      height: 64,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }

          return Column(
            children: [
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Text(
                      '${_fields.length} campos',
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const Spacer(),
                    FilledButton.icon(
                      onPressed: _addField,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Agregar'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: _fields.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.text_fields,
                                size: 48, color: AppColors.textMuted),
                            SizedBox(height: 12),
                            Text(
                              'Sin campos personalizados',
                              style:
                                  TextStyle(color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      )
                    : ReorderableListView.builder(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 4),
                        itemCount: _fields.length,
                        onReorder: (oldIdx, newIdx) {
                          setState(() {
                            if (newIdx > oldIdx) newIdx--;
                            final item = _fields.removeAt(oldIdx);
                            _fields.insert(newIdx, item);
                          });
                        },
                        itemBuilder: (context, index) {
                          final field = _fields[index];
                          return Card(
                            key: ValueKey('field_$index'),
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              leading: const Icon(Icons.drag_handle,
                                  color: AppColors.textMuted),
                              title: Text(field.name),
                              subtitle: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryMuted,
                                      borderRadius:
                                          BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      field.type,
                                      style: const TextStyle(
                                        color: AppColors.primary,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ),
                                  if (field.required) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding:
                                          const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 2),
                                      decoration: BoxDecoration(
                                        color: AppColors.warningMuted,
                                        borderRadius:
                                            BorderRadius.circular(4),
                                      ),
                                      child: const Text(
                                        'Requerido',
                                        style: TextStyle(
                                          color: AppColors.warning,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              trailing: IconButton(
                                icon: const Icon(
                                    Icons.delete_outline,
                                    color: AppColors.error),
                                onPressed: () =>
                                    _confirmDelete(index),
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
