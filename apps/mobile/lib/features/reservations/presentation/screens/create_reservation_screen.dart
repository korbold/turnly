import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../infrastructure/reservation_repository_impl.dart';
import '../../domain/repositories/i_reservation_repository.dart';
import '../widgets/slot_picker.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../shared/extensions/date_extensions.dart';

class _ClientResource {
  final String id;
  final String label;
  _ClientResource({required this.id, required this.label});
}

class _Service {
  final String id;
  final String name;
  final String? price;
  _Service({required this.id, required this.name, this.price});
}

class CreateReservationScreen extends StatefulWidget {
  const CreateReservationScreen({super.key});

  @override
  State<CreateReservationScreen> createState() =>
      _CreateReservationScreenState();
}

class _CreateReservationScreenState extends State<CreateReservationScreen> {
  final _repo = ReservationRepositoryImpl();
  final Dio _dio = DioClient.instance;

  int _step = 0;

  // Step 1: client resource
  List<_ClientResource> _clientResources = [];
  _ClientResource? _selectedClientResource;
  bool _loadingClientResources = false;
  String? _clientResourcesError;

  // Step 2: service
  List<_Service> _services = [];
  _Service? _selectedService;
  bool _loadingServices = false;
  String? _servicesError;

  // Step 3: date + slot
  DateTime _selectedDate = DateTime.now();
  DateTime? _selectedSlot;
  List<AvailableSlot> _slots = [];
  bool _loadingSlots = false;
  String? _slotsError;

  // Notes
  final _notesController = TextEditingController();

  // Submission
  bool _submitting = false;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    _loadClientResources();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadClientResources() async {
    setState(() {
      _loadingClientResources = true;
      _clientResourcesError = null;
    });
    try {
      final response = await _dio.get('/client-resources');
      final data = response.data['data'] as List<dynamic>;
      setState(() {
        _clientResources = data.map((e) {
          final map = e as Map<String, dynamic>;
          final label = map['label'] as String? ?? map['id'] as String;
          return _ClientResource(id: map['id'] as String, label: label);
        }).toList();
        _loadingClientResources = false;
      });
    } catch (e) {
      setState(() {
        _clientResourcesError = 'Error al cargar recursos';
        _loadingClientResources = false;
      });
    }
  }

  Future<void> _loadServices() async {
    setState(() {
      _loadingServices = true;
      _servicesError = null;
    });
    try {
      final response = await _dio.get('/services');
      final data = response.data['data'] as List<dynamic>;
      setState(() {
        _services = data.map((e) {
          final map = e as Map<String, dynamic>;
          return _Service(
            id: map['id'] as String,
            name: map['name'] as String? ?? '',
            price: map['price']?.toString(),
          );
        }).toList();
        _loadingServices = false;
      });
    } catch (e) {
      setState(() {
        _servicesError = 'Error al cargar servicios';
        _loadingServices = false;
      });
    }
  }

  Future<void> _loadSlots() async {
    if (_selectedService == null) return;
    setState(() {
      _loadingSlots = true;
      _slotsError = null;
      _selectedSlot = null;
      _slots = [];
    });

    final result = await _repo.getAvailableSlots(
      _selectedDate.toApiDate(),
      _selectedService!.id,
    );

    result.fold(
      (f) => setState(() {
        _slotsError = f.message;
        _loadingSlots = false;
      }),
      (slots) => setState(() {
        _slots = slots;
        _loadingSlots = false;
      }),
    );
  }

  Future<void> _submit() async {
    if (_selectedClientResource == null ||
        _selectedService == null ||
        _selectedSlot == null) {
      return;
    }
    setState(() {
      _submitting = true;
      _submitError = null;
    });

    final result = await _repo.create(
      clientResourceId: _selectedClientResource!.id,
      serviceId: _selectedService!.id,
      scheduledAt: _selectedSlot!.toApiFormat(),
      notes: _notesController.text.trim().isEmpty
          ? null
          : _notesController.text.trim(),
    );

    result.fold(
      (f) => setState(() {
        _submitError = f.message;
        _submitting = false;
      }),
      (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Reservación creada exitosamente'),
              backgroundColor: Colors.green,
            ),
          );
          context.pop();
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nueva Reservación'),
      ),
      body: Stepper(
        currentStep: _step,
        onStepContinue: _onStepContinue,
        onStepCancel: _onStepCancel,
        controlsBuilder: (context, details) {
          return Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Row(
              children: [
                if (_step < 3)
                  Expanded(
                    child: ElevatedButton(
                      onPressed: details.onStepContinue,
                      child: const Text('Continuar'),
                    ),
                  )
                else
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _submitting ? null : _submit,
                      child: _submitting
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Confirmar'),
                    ),
                  ),
                if (_step > 0) ...[
                  const SizedBox(width: 12),
                  TextButton(
                    onPressed: details.onStepCancel,
                    child: const Text('Atrás'),
                  ),
                ],
              ],
            ),
          );
        },
        steps: [
          Step(
            title: const Text('Recurso'),
            isActive: _step >= 0,
            state: _step > 0 ? StepState.complete : StepState.indexed,
            content: _buildClientResourceStep(),
          ),
          Step(
            title: const Text('Servicio'),
            isActive: _step >= 1,
            state: _step > 1 ? StepState.complete : StepState.indexed,
            content: _buildServiceStep(),
          ),
          Step(
            title: const Text('Fecha y hora'),
            isActive: _step >= 2,
            state: _step > 2 ? StepState.complete : StepState.indexed,
            content: _buildDateSlotStep(),
          ),
          Step(
            title: const Text('Confirmar'),
            isActive: _step >= 3,
            state: StepState.indexed,
            content: _buildConfirmStep(),
          ),
        ],
      ),
    );
  }

  void _onStepContinue() {
    if (_step == 0 && _selectedClientResource == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona un recurso')),
      );
      return;
    }
    if (_step == 1 && _selectedService == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona un servicio')),
      );
      return;
    }
    if (_step == 2 && _selectedSlot == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona un horario')),
      );
      return;
    }
    if (_step == 1 && _selectedService != null) {
      _loadSlots();
    }
    setState(() => _step++);
  }

  void _onStepCancel() {
    if (_step > 0) setState(() => _step--);
  }

  Widget _buildClientResourceStep() {
    if (_loadingClientResources) {
      return const Center(
          child: Padding(
        padding: EdgeInsets.all(16),
        child: CircularProgressIndicator(),
      ));
    }
    if (_clientResourcesError != null) {
      return Column(
        children: [
          Text(_clientResourcesError!, style: const TextStyle(color: Colors.red)),
          TextButton(
            onPressed: _loadClientResources,
            child: const Text('Reintentar'),
          ),
        ],
      );
    }
    if (_clientResources.isEmpty) {
      return const Text('No tienes recursos registrados.');
    }
    return Column(
      children: _clientResources
          .map(
            (v) => RadioListTile<_ClientResource>(
              title: Text(v.label),
              value: v,
              groupValue: _selectedClientResource,
              onChanged: (val) => setState(() => _selectedClientResource = val),
            ),
          )
          .toList(),
    );
  }

  Widget _buildServiceStep() {
    if (_step == 1 && _services.isEmpty && !_loadingServices) {
      _loadServices();
    }
    if (_loadingServices) {
      return const Center(
          child: Padding(
        padding: EdgeInsets.all(16),
        child: CircularProgressIndicator(),
      ));
    }
    if (_servicesError != null) {
      return Column(
        children: [
          Text(_servicesError!, style: const TextStyle(color: Colors.red)),
          TextButton(
            onPressed: _loadServices,
            child: const Text('Reintentar'),
          ),
        ],
      );
    }
    if (_services.isEmpty) {
      return const Text('No hay servicios disponibles.');
    }
    return Column(
      children: _services
          .map(
            (s) => RadioListTile<_Service>(
              title: Text(s.name),
              subtitle: s.price != null ? Text('\$${s.price}') : null,
              value: s,
              groupValue: _selectedService,
              onChanged: (val) => setState(() => _selectedService = val),
            ),
          )
          .toList(),
    );
  }

  Widget _buildDateSlotStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        OutlinedButton.icon(
          icon: const Icon(Icons.calendar_month),
          label: Text(_selectedDate.toDisplayDate()),
          onPressed: _pickDate,
        ),
        const SizedBox(height: 16),
        const Text(
          'Horarios disponibles',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        if (_loadingSlots)
          const Center(child: CircularProgressIndicator())
        else if (_slotsError != null)
          Text(_slotsError!, style: const TextStyle(color: Colors.red))
        else
          SlotPicker(
            slots: _slots,
            selected: _selectedSlot,
            onSelected: (dt) => setState(() => _selectedSlot = dt),
          ),
        const SizedBox(height: 16),
        TextField(
          controller: _notesController,
          decoration: const InputDecoration(
            labelText: 'Notas (opcional)',
            prefixIcon: Icon(Icons.notes),
            border: OutlineInputBorder(),
          ),
          maxLines: 2,
        ),
      ],
    );
  }

  Widget _buildConfirmStep() {
    if (_submitError != null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(
          _submitError!,
          style: const TextStyle(color: Colors.red),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _confirmRow(
          Icons.label,
          'Recurso',
          _selectedClientResource?.label ?? '-',
        ),
        const SizedBox(height: 8),
        _confirmRow(
          Icons.build,
          'Servicio',
          _selectedService?.name ?? '-',
        ),
        const SizedBox(height: 8),
        _confirmRow(
          Icons.access_time,
          'Fecha y hora',
          _selectedSlot?.toDisplayDateTime() ?? '-',
        ),
        if (_notesController.text.trim().isNotEmpty) ...[
          const SizedBox(height: 8),
          _confirmRow(Icons.notes, 'Notas', _notesController.text.trim()),
        ],
      ],
    );
  }

  Widget _confirmRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: Colors.grey),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
            Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
          ],
        ),
      ],
    );
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
}
