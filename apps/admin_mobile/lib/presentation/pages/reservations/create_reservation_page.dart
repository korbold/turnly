import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../application/use_cases/reservations/create_reservation_use_case.dart';
import '../../../application/use_cases/reservations/get_available_slots_use_case.dart';
import '../../../application/use_cases/services/get_services_use_case.dart';
import '../../../application/use_cases/clients/get_clients_use_case.dart';
import '../../../application/use_cases/team/get_team_use_case.dart';
import '../../../domain/entities/client_resource.dart';
import '../../../domain/entities/reservation.dart';
import '../../../domain/entities/service.dart';
import '../../../domain/entities/user.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';

class CreateReservationPage extends StatefulWidget {
  const CreateReservationPage({super.key});

  @override
  State<CreateReservationPage> createState() => _CreateReservationPageState();
}

class _CreateReservationPageState extends State<CreateReservationPage> {
  final _pageController = PageController();
  int _currentStep = 0;

  // Step 1: Service
  List<Service> _services = [];
  Service? _selectedService;
  bool _loadingServices = true;

  // Step 2: Date + Slot
  DateTime _selectedDate = DateTime.now();
  List<AvailableSlot> _slots = [];
  AvailableSlot? _selectedSlot;
  bool _loadingSlots = false;

  // Step 3: Client resource
  List<ClientResource> _clients = [];
  ClientResource? _selectedClient;
  bool _loadingClients = false;
  final _searchController = TextEditingController();

  // Step 4: Employee + Notes
  List<User> _employees = [];
  User? _selectedEmployee;
  final _notesController = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadServices();
    _loadClients();
    _loadEmployees();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _searchController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadServices() async {
    try {
      final result = await getIt<GetServicesUseCase>().call();
      if (mounted) {
        setState(() {
          _services = result.data.where((s) => s.isActive).toList();
          _loadingServices = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingServices = false);
    }
  }

  Future<void> _loadSlots() async {
    if (_selectedService == null) return;
    setState(() => _loadingSlots = true);
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final slots = await getIt<GetAvailableSlotsUseCase>()
          .call(dateStr, _selectedService!.id);
      if (mounted) {
        setState(() {
          _slots = slots;
          _selectedSlot = null;
          _loadingSlots = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingSlots = false);
    }
  }

  Future<void> _loadClients({String? search}) async {
    setState(() => _loadingClients = true);
    try {
      final result = await getIt<GetClientsUseCase>().call(search: search);
      if (mounted) {
        setState(() {
          _clients = result.data;
          _loadingClients = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingClients = false);
    }
  }

  Future<void> _loadEmployees() async {
    try {
      final result = await getIt<GetTeamUseCase>()
          .call(excludeRole: UserRole.client);
      if (mounted) setState(() => _employees = result.data);
    } catch (_) {}
  }

  void _goToStep(int step) {
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
    setState(() => _currentStep = step);
  }

  void _next() {
    if (_currentStep < 3) _goToStep(_currentStep + 1);
  }

  void _prev() {
    if (_currentStep > 0) _goToStep(_currentStep - 1);
  }

  bool get _canProceed {
    switch (_currentStep) {
      case 0:
        return _selectedService != null;
      case 1:
        return _selectedSlot != null;
      case 2:
        return _selectedClient != null;
      case 3:
        return true;
      default:
        return false;
    }
  }

  Future<void> _submit() async {
    if (_selectedService == null ||
        _selectedSlot == null ||
        _selectedClient == null) return;

    setState(() => _submitting = true);
    try {
      final scheduledAt =
          DateFormat("yyyy-MM-dd'T'HH:mm:ss").format(_selectedSlot!.start);

      await getIt<CreateReservationUseCase>().call(
        clientResourceId: _selectedClient!.id,
        serviceId: _selectedService!.id,
        scheduledAt: scheduledAt,
        assignedTo: _selectedEmployee?.id,
        notes: _notesController.text.isEmpty ? null : _notesController.text,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reserva creada exitosamente'),
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
        title: const Text('Nueva Reserva'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          // Step indicator
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: List.generate(4, (i) {
                final labels = ['Servicio', 'Horario', 'Vehiculo', 'Detalles'];
                return Expanded(
                  child: Row(
                    children: [
                      if (i > 0)
                        Expanded(
                          child: Container(
                            height: 2,
                            color: i <= _currentStep
                                ? AppColors.primary
                                : AppColors.cardBorder,
                          ),
                        ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              color: i <= _currentStep
                                  ? AppColors.primary
                                  : AppColors.cardBorder,
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: i < _currentStep
                                  ? const Icon(Icons.check,
                                      size: 16, color: Colors.white)
                                  : Text(
                                      '${i + 1}',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: i <= _currentStep
                                            ? Colors.white
                                            : AppColors.textMuted,
                                      ),
                                    ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            labels[i],
                            style: TextStyle(
                              fontSize: 10,
                              color: i <= _currentStep
                                  ? AppColors.primary
                                  : AppColors.textMuted,
                              fontWeight: i == _currentStep
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }),
            ),
          ),
          const Divider(height: 1),

          // Pages
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              onPageChanged: (i) => setState(() => _currentStep = i),
              children: [
                _buildServiceStep(),
                _buildDateTimeStep(),
                _buildClientStep(),
                _buildDetailsStep(),
              ],
            ),
          ),

          // Bottom nav
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: AppColors.cardBorder)),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  if (_currentStep > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _prev,
                        child: const Text('Atras'),
                      ),
                    ),
                  if (_currentStep > 0) const SizedBox(width: 12),
                  Expanded(
                    flex: _currentStep == 0 ? 1 : 1,
                    child: _currentStep == 3
                        ? FilledButton(
                            onPressed:
                                _canProceed && !_submitting ? _submit : null,
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.primary,
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
                                : const Text('Crear Reserva'),
                          )
                        : FilledButton(
                            onPressed: _canProceed ? _next : null,
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.primary,
                            ),
                            child: const Text('Siguiente'),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Step 1: Select Service ──────────────────────────────────────────────
  Widget _buildServiceStep() {
    if (_loadingServices) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    if (_services.isEmpty) {
      return const Center(
        child: Text(
          'No hay servicios disponibles',
          style: TextStyle(color: AppColors.textMuted),
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 1.3,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: _services.length,
      itemBuilder: (context, index) {
        final service = _services[index];
        final isSelected = _selectedService?.id == service.id;
        return GestureDetector(
          onTap: () {
            setState(() => _selectedService = service);
            _loadSlots();
          },
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isSelected ? AppColors.primaryMuted : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected ? AppColors.primary : AppColors.cardBorder,
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.local_car_wash,
                  color: isSelected ? AppColors.primary : AppColors.textMuted,
                  size: 28,
                ),
                const SizedBox(height: 8),
                Text(
                  service.name,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isSelected
                        ? AppColors.primary
                        : AppColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  '\$${service.price.toStringAsFixed(2)}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: isSelected
                        ? AppColors.primary
                        : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // ── Step 2: Date + Time Slot ────────────────────────────────────────────
  Widget _buildDateTimeStep() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Date picker
        const Text(
          'Seleccione fecha',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: _selectedDate,
              firstDate: DateTime.now(),
              lastDate: DateTime.now().add(const Duration(days: 90)),
            );
            if (picked != null) {
              setState(() => _selectedDate = picked);
              _loadSlots();
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Row(
              children: [
                const Icon(Icons.calendar_today,
                    size: 18, color: AppColors.primary),
                const SizedBox(width: 12),
                Text(
                  DateFormat("EEEE d 'de' MMMM", 'es').format(_selectedDate),
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                const Icon(Icons.chevron_right, color: AppColors.textMuted),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),

        // Time slots
        const Text(
          'Seleccione horario',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        if (_loadingSlots)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          )
        else if (_slots.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            alignment: Alignment.center,
            child: const Text(
              'No hay horarios disponibles.\nSeleccione un servicio primero.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted),
            ),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _slots.map((slot) {
              final isSelected = _selectedSlot == slot;
              final available = slot.available > 0;
              final timeStr = DateFormat('HH:mm').format(slot.start);
              return GestureDetector(
                onTap: available
                    ? () => setState(() => _selectedSlot = slot)
                    : null,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.primary
                        : available
                            ? Colors.white
                            : AppColors.background,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isSelected
                          ? AppColors.primary
                          : available
                              ? AppColors.cardBorder
                              : AppColors.cardBorder,
                    ),
                  ),
                  child: Column(
                    children: [
                      Text(
                        timeStr,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: isSelected
                              ? Colors.white
                              : available
                                  ? AppColors.textPrimary
                                  : AppColors.textMuted,
                        ),
                      ),
                      Text(
                        '${slot.available} disp.',
                        style: TextStyle(
                          fontSize: 11,
                          color: isSelected
                              ? Colors.white70
                              : AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
      ],
    );
  }

  // ── Step 3: Client Resource ─────────────────────────────────────────────
  Widget _buildClientStep() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              hintText: 'Buscar por placa, nombre...',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) {
              _loadClients(search: value.isEmpty ? null : value);
            },
          ),
        ),
        Expanded(
          child: _loadingClients
              ? const Center(
                  child:
                      CircularProgressIndicator(color: AppColors.primary))
              : _clients.isEmpty
                  ? const Center(
                      child: Text(
                        'No se encontraron vehiculos',
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _clients.length,
                      itemBuilder: (context, index) {
                        final client = _clients[index];
                        final isSelected =
                            _selectedClient?.id == client.id;
                        return GestureDetector(
                          onTap: () =>
                              setState(() => _selectedClient = client),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.primaryMuted
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected
                                    ? AppColors.primary
                                    : AppColors.cardBorder,
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? AppColors.primary
                                        : AppColors.background,
                                    borderRadius:
                                        BorderRadius.circular(8),
                                  ),
                                  child: Icon(
                                    Icons.directions_car,
                                    color: isSelected
                                        ? Colors.white
                                        : AppColors.textMuted,
                                    size: 20,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        client.plate ?? 'Sin placa',
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                      Text(
                                        [
                                          client.brand,
                                          client.model,
                                          client.color
                                        ]
                                            .where((e) => e != null)
                                            .join(' - '),
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                      if (client.clientName != null)
                                        Text(
                                          client.clientName!,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppColors.textMuted,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                if (isSelected)
                                  const Icon(Icons.check_circle,
                                      color: AppColors.primary,
                                      size: 24),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }

  // ── Step 4: Employee + Notes + Confirm ──────────────────────────────────
  Widget _buildDetailsStep() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Summary
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.primaryMuted,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Resumen',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 8),
              _summaryRow('Servicio', _selectedService?.name ?? '---'),
              _summaryRow(
                  'Precio',
                  _selectedService != null
                      ? '\$${_selectedService!.price.toStringAsFixed(2)}'
                      : '---'),
              _summaryRow(
                  'Fecha',
                  DateFormat("d MMM yyyy", 'es').format(_selectedDate)),
              _summaryRow(
                  'Hora',
                  _selectedSlot != null
                      ? DateFormat('HH:mm').format(_selectedSlot!.start)
                      : '---'),
              _summaryRow(
                  'Vehiculo', _selectedClient?.plate ?? '---'),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Employee dropdown
        const Text(
          'Empleado (opcional)',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<User?>(
              value: _selectedEmployee,
              hint: const Text('Seleccionar empleado'),
              isExpanded: true,
              items: [
                const DropdownMenuItem<User?>(
                  value: null,
                  child: Text('Sin asignar'),
                ),
                ..._employees.map((e) => DropdownMenuItem<User?>(
                      value: e,
                      child: Text(e.name),
                    )),
              ],
              onChanged: (v) => setState(() => _selectedEmployee = v),
            ),
          ),
        ),
        const SizedBox(height: 20),

        // Notes
        const Text(
          'Notas (opcional)',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _notesController,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Instrucciones especiales, comentarios...',
          ),
        ),
      ],
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
