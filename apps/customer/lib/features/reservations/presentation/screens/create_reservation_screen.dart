import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/extensions/date_extensions.dart';
import '../widgets/slot_picker.dart';
import '../../domain/repositories/i_reservation_repository.dart';

class CreateReservationScreen extends StatefulWidget {
  const CreateReservationScreen({super.key});

  @override
  State<CreateReservationScreen> createState() => _CreateReservationScreenState();
}

class _CreateReservationScreenState extends State<CreateReservationScreen> {
  final Dio _dio = DioClient.instance;
  final _notesController = TextEditingController();

  String? _slug;
  Map<String, dynamic>? _service;
  List<Map<String, dynamic>> _customFields = [];

  // Client resources (vehicles)
  List<Map<String, dynamic>> _myResources = [];
  bool _loadingResources = true;
  Map<String, dynamic>? _selectedResource;
  bool _creatingNew = false;
  final Map<String, TextEditingController> _fieldControllers = {};

  // Date & slot
  DateTime _selectedDate = DateTime.now();
  DateTime? _selectedSlot;
  List<AvailableSlot> _slots = [];
  bool _loadingSlots = false;
  String? _slotsError;

  // Submission
  bool _submitting = false;
  String? _submitError;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final extra = GoRouterState.of(context).extra;
    if (extra is Map<String, dynamic> && _slug == null) {
      _slug = extra['slug'] as String?;
      _service = extra['service'] as Map<String, dynamic>?;
      final fields = extra['custom_fields'];
      if (fields is List) {
        _customFields = fields.cast<Map<String, dynamic>>();
        for (final field in _customFields) {
          final key = field['key'] as String? ?? '';
          _fieldControllers[key] = TextEditingController();
        }
      }
      if (_slug != null && _service != null) {
        _loadMyResources();
        _loadSlots();
      }
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    for (final c in _fieldControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadMyResources() async {
    if (_slug == null) return;
    try {
      final response = await _dio.get('/public/tenants/$_slug/my-resources');
      final data = response.data['data'] as List<dynamic>;
      if (mounted) {
        setState(() {
          _myResources = data.cast<Map<String, dynamic>>();
          _loadingResources = false;
          if (_myResources.isNotEmpty) {
            _selectedResource = _myResources.first;
          } else if (_customFields.isNotEmpty) {
            _creatingNew = true;
          }
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loadingResources = false;
          if (_customFields.isNotEmpty) _creatingNew = true;
        });
      }
    }
  }

  Future<void> _loadSlots() async {
    if (_slug == null || _service == null) return;
    setState(() {
      _loadingSlots = true;
      _slotsError = null;
      _selectedSlot = null;
      _slots = [];
    });

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final response = await _dio.get(
        '/public/tenants/$_slug/available-slots',
        queryParameters: {
          'date': dateStr,
          'service_id': _service!['id'],
        },
      );
      final data = response.data['data'] as List<dynamic>;
      final parsed = data.map((e) {
        final map = e as Map<String, dynamic>;
        return AvailableSlot(
          start: DateTime.parse(map['start'] as String),
          end: DateTime.parse(map['end'] as String),
          available: map['available'] as int? ?? 0,
        );
      }).toList();

      // If no slots available for today, auto-advance to next day
      if (parsed.isEmpty && _isToday(_selectedDate)) {
        setState(() {
          _selectedDate = _selectedDate.add(const Duration(days: 1));
        });
        _loadSlots();
        return;
      }

      setState(() {
        _slots = parsed;
        _loadingSlots = false;
      });
    } catch (e) {
      setState(() {
        _slotsError = 'No se pudieron cargar los horarios';
        _loadingSlots = false;
      });
    }
  }

  bool _validateResourceFields() {
    for (final field in _customFields) {
      final key = field['key'] as String? ?? '';
      final required = field['required'] as bool? ?? false;
      if (required && (_fieldControllers[key]?.text.trim().isEmpty ?? true)) {
        return false;
      }
    }
    return true;
  }

  Map<String, dynamic> _buildResourceData() {
    final data = <String, dynamic>{};
    for (final field in _customFields) {
      final key = field['key'] as String? ?? '';
      final value = _fieldControllers[key]?.text.trim() ?? '';
      if (value.isNotEmpty) {
        data[key] = value;
      }
    }
    return data;
  }

  bool get _hasResourceSelection {
    if (_customFields.isEmpty) return true;
    if (_selectedResource != null) return true;
    if (_creatingNew && _validateResourceFields()) return true;
    return false;
  }

  Future<void> _submit() async {
    if (_slug == null || _service == null || _selectedSlot == null) return;

    setState(() { _submitting = true; _submitError = null; });

    try {
      final body = <String, dynamic>{
        'service_id': _service!['id'],
        'scheduled_at': _selectedSlot!.toIso8601String(),
        if (_notesController.text.trim().isNotEmpty)
          'notes': _notesController.text.trim(),
      };

      if (_selectedResource != null) {
        body['client_resource_id'] = _selectedResource!['id'];
      } else if (_creatingNew && _customFields.isNotEmpty) {
        body['client_resource_data'] = _buildResourceData();
      }

      await _dio.post('/public/tenants/$_slug/book', data: body);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reservación creada exitosamente'),
            backgroundColor: Colors.green,
          ),
        );
        context.pop();
      }
    } on DioException catch (e) {
      final data = e.response?.data;
      String msg = 'Error al crear la reservación';
      if (data is Map) {
        msg = data['error']?['message']?.toString() ?? data['message']?.toString() ?? msg;
      }
      setState(() { _submitError = msg; _submitting = false; });
    } catch (e) {
      setState(() { _submitError = e.toString(); _submitting = false; });
    }
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month && date.day == now.day;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 60)),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
        _selectedSlot = null;
        _slots = [];
      });
      _loadSlots();
    }
  }

  @override
  Widget build(BuildContext context) {
    final serviceName = _service?['name'] as String? ?? 'Servicio';
    final servicePrice = _service?['price'];
    final currency = NumberFormat.currency(locale: 'es', symbol: '\$', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(title: const Text('Nueva Reservación')),
      body: _slug == null || _service == null
          ? const Center(child: Text('Datos del servicio no disponibles', style: TextStyle(color: AppColors.bodyText)))
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Service info
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border, width: 0.5),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.event_available, color: AppColors.primary),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(serviceName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                            if (servicePrice != null)
                              Text(
                                currency.format(double.tryParse(servicePrice.toString()) ?? 0),
                                style: const TextStyle(fontSize: 14, color: AppColors.primary, fontWeight: FontWeight.w700),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // Vehicle / Client Resource section
                if (_customFields.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  _buildResourceSection(),
                ],

                const SizedBox(height: 24),

                // Date picker
                const Text('Selecciona una fecha', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  icon: const Icon(Icons.calendar_month),
                  label: Text(_selectedDate.toDisplayDate()),
                  onPressed: _pickDate,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50),
                  ),
                ),

                const SizedBox(height: 24),

                // Time slots
                const Text('Horarios disponibles', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                const SizedBox(height: 12),
                if (_loadingSlots)
                  const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
                else if (_slotsError != null)
                  Column(
                    children: [
                      Text(_slotsError!, style: const TextStyle(color: AppColors.error)),
                      const SizedBox(height: 8),
                      TextButton(onPressed: _loadSlots, child: const Text('Reintentar')),
                    ],
                  )
                else if (_slots.isEmpty)
                  const Text('No hay horarios disponibles para esta fecha', style: TextStyle(color: AppColors.bodyText))
                else
                  SlotPicker(
                    slots: _slots,
                    selected: _selectedSlot,
                    onSelected: (dt) => setState(() => _selectedSlot = dt),
                  ),

                const SizedBox(height: 24),

                // Notes
                TextField(
                  controller: _notesController,
                  decoration: const InputDecoration(
                    labelText: 'Notas (opcional)',
                    prefixIcon: Icon(Icons.notes, color: AppColors.bodyText),
                  ),
                  maxLines: 2,
                ),

                const SizedBox(height: 24),

                // Error
                if (_submitError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(_submitError!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
                    ),
                  ),

                // Submit
                ElevatedButton(
                  onPressed: _selectedSlot != null && !_submitting && _hasResourceSelection ? _submit : null,
                  child: _submitting
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Confirmar reservación'),
                ),
              ],
            ),
    );
  }

  Widget _buildResourceSection() {
    if (_loadingResources) {
      return const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Tu vehículo', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
        const SizedBox(height: 12),

        // Show existing resources to select
        if (_myResources.isNotEmpty) ...[
          ..._myResources.map((r) => _buildResourceOption(r)),
          const SizedBox(height: 8),
          // Option to add new
          _buildNewResourceOption(),
        ],

        // Show form for new resource
        if (_creatingNew) ...[
          const SizedBox(height: 12),
          _buildResourceForm(),
        ],
      ],
    );
  }

  Widget _buildResourceOption(Map<String, dynamic> resource) {
    final isSelected = _selectedResource?['id'] == resource['id'];
    final data = resource['data'] as Map<String, dynamic>? ?? {};

    // Build a label from the data fields
    final parts = <String>[];
    for (final field in _customFields) {
      final key = field['key'] as String? ?? '';
      final value = data[key]?.toString();
      if (value != null && value.isNotEmpty) {
        parts.add(value);
      }
    }
    final displayLabel = parts.isNotEmpty ? parts.join(' · ') : 'Vehículo';

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedResource = resource;
          _creatingNew = false;
        });
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.accent : AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 2 : 0.5,
          ),
        ),
        child: Row(
          children: [
            Icon(
              Icons.directions_car,
              color: isSelected ? AppColors.primary : AppColors.bodyText,
              size: 24,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                displayLabel,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  color: isSelected ? AppColors.primary : AppColors.darkText,
                ),
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle, color: AppColors.primary, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildNewResourceOption() {
    final isSelected = _creatingNew;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedResource = null;
          _creatingNew = true;
        });
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.accent : AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 2 : 0.5,
          ),
        ),
        child: Row(
          children: [
            Icon(
              Icons.add_circle_outline,
              color: isSelected ? AppColors.primary : AppColors.bodyText,
              size: 24,
            ),
            const SizedBox(width: 12),
            Text(
              'Registrar nuevo vehículo',
              style: TextStyle(
                fontSize: 14,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                color: isSelected ? AppColors.primary : AppColors.darkText,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResourceForm() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Datos del vehículo',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.darkText),
          ),
          const SizedBox(height: 12),
          ..._customFields.map((field) {
            final key = field['key'] as String? ?? '';
            final label = field['label'] as String? ?? key;
            final required = field['required'] as bool? ?? false;
            final uppercase = field['uppercase'] as bool? ?? false;

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextField(
                controller: _fieldControllers[key],
                textCapitalization: uppercase ? TextCapitalization.characters : TextCapitalization.sentences,
                decoration: InputDecoration(
                  labelText: required ? '$label *' : label,
                  border: const OutlineInputBorder(),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                ),
                onChanged: (_) => setState(() {}),
              ),
            );
          }),
        ],
      ),
    );
  }
}
