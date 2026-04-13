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
      if (_slug != null && _service != null) {
        _loadSlots();
      }
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
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
      setState(() {
        _slots = data.map((e) {
          final map = e as Map<String, dynamic>;
          return AvailableSlot(
            start: DateTime.parse(map['start'] as String),
            end: DateTime.parse(map['end'] as String),
            available: map['available'] as int? ?? 0,
          );
        }).toList();
        _loadingSlots = false;
      });
    } catch (e) {
      setState(() {
        _slotsError = 'No se pudieron cargar los horarios';
        _loadingSlots = false;
      });
    }
  }

  Future<void> _submit() async {
    if (_slug == null || _service == null || _selectedSlot == null) return;

    setState(() { _submitting = true; _submitError = null; });

    try {
      await _dio.post('/public/tenants/$_slug/book', data: {
        'service_id': _service!['id'],
        'scheduled_at': _selectedSlot!.toIso8601String(),
        if (_notesController.text.trim().isNotEmpty)
          'notes': _notesController.text.trim(),
      });

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
                  onPressed: _selectedSlot != null && !_submitting ? _submit : null,
                  child: _submitting
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Confirmar reservación'),
                ),
              ],
            ),
    );
  }
}
