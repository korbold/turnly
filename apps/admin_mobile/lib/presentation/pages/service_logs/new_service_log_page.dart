import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../application/use_cases/services/get_services_use_case.dart';
import '../../../application/use_cases/clients/get_clients_use_case.dart';
import '../../../application/use_cases/team/get_team_use_case.dart';
import '../../../application/use_cases/service_logs/create_service_log_use_case.dart';
import '../../../domain/entities/client_resource.dart';
import '../../../domain/entities/service.dart';
import '../../../domain/entities/service_log.dart';
import '../../../domain/entities/user.dart';
import '../../../injection.dart';
import '../../../shared/constants/colors.dart';
import '../../../shared/constants/status.dart';

class NewServiceLogPage extends StatefulWidget {
  const NewServiceLogPage({super.key});

  @override
  State<NewServiceLogPage> createState() => _NewServiceLogPageState();
}

class _NewServiceLogPageState extends State<NewServiceLogPage> {
  // Data
  List<Service> _services = [];
  List<ClientResource> _clients = [];
  List<User> _employees = [];
  bool _loadingServices = true;
  bool _loadingClients = false;

  // Form state
  Service? _selectedService;
  ClientResource? _selectedClient;
  User? _selectedEmployee;
  final _priceController = TextEditingController();
  PaymentMethod _paymentMethod = PaymentMethod.cash;
  final _notesController = TextEditingController();
  final _searchController = TextEditingController();
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
    _priceController.dispose();
    _notesController.dispose();
    _searchController.dispose();
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
      final result =
          await getIt<GetTeamUseCase>().call(excludeRole: UserRole.client);
      if (mounted) setState(() => _employees = result.data);
    } catch (_) {}
  }

  void _selectService(Service service) {
    setState(() {
      _selectedService = service;
      _priceController.text = service.price.toStringAsFixed(2);
    });
  }

  bool get _canSubmit =>
      _selectedService != null &&
      _selectedClient != null &&
      _selectedEmployee != null &&
      _priceController.text.isNotEmpty;

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);
    try {
      await getIt<CreateServiceLogUseCase>().call(
        clientResourceId: _selectedClient!.id,
        serviceId: _selectedService!.id,
        attendedBy: _selectedEmployee!.id,
        priceCharged: double.tryParse(_priceController.text) ??
            _selectedService!.price,
        paymentMethod: _paymentMethod,
        notes:
            _notesController.text.isEmpty ? null : _notesController.text,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Registro creado exitosamente'),
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
        title: const Text('Nuevo Registro'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Service selection ───────────────────────────────────────
          const Text(
            'Servicio',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          if (_loadingServices)
            const Padding(
              padding: EdgeInsets.all(20),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            )
          else
            SizedBox(
              height: 100,
              child: GridView.builder(
                scrollDirection: Axis.horizontal,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 1,
                  mainAxisSpacing: 8,
                  mainAxisExtent: 140,
                ),
                itemCount: _services.length,
                itemBuilder: (context, index) {
                  final service = _services[index];
                  final isSelected = _selectedService?.id == service.id;
                  return GestureDetector(
                    onTap: () => _selectService(service),
                    child: Container(
                      padding: const EdgeInsets.all(10),
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
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.local_car_wash,
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.textMuted,
                            size: 22,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            service.name,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            '\$${service.price.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 12,
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
              ),
            ),
          const SizedBox(height: 20),

          // ── Client resource search ─────────────────────────────────
          const Text(
            'Vehiculo / Cliente',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              hintText: 'Buscar por placa, nombre...',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) {
              _loadClients(search: value.isEmpty ? null : value);
            },
          ),
          const SizedBox(height: 8),
          if (_loadingClients)
            const Padding(
              padding: EdgeInsets.all(12),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            )
          else if (_clients.isNotEmpty)
            SizedBox(
              height: 120,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _clients.length,
                itemBuilder: (context, index) {
                  final client = _clients[index];
                  final isSelected = _selectedClient?.id == client.id;
                  return GestureDetector(
                    onTap: () =>
                        setState(() => _selectedClient = client),
                    child: Container(
                      width: 140,
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.all(10),
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
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.directions_car,
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.textMuted,
                            size: 20,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            client.plate ?? 'Sin placa',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.textPrimary,
                            ),
                          ),
                          Text(
                            [client.brand, client.model]
                                .where((e) => e != null)
                                .join(' '),
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (client.clientName != null)
                            Text(
                              client.clientName!,
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            )
          else if (_selectedClient != null)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primaryMuted,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.primary),
              ),
              child: Row(
                children: [
                  const Icon(Icons.directions_car,
                      color: AppColors.primary, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    '${_selectedClient!.plate ?? 'Sin placa'} - ${_selectedClient!.clientName ?? ''}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w500,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 20),

          // ── Employee dropdown ──────────────────────────────────────
          const Text(
            'Empleado',
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
                items: _employees
                    .map((e) => DropdownMenuItem<User?>(
                          value: e,
                          child: Text(e.name),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _selectedEmployee = v),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // ── Price ──────────────────────────────────────────────────
          const Text(
            'Precio',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _priceController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              prefixText: '\$ ',
              hintText: '0.00',
            ),
          ),
          const SizedBox(height: 20),

          // ── Payment method ─────────────────────────────────────────
          const Text(
            'Metodo de Pago',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: PaymentMethod.values.map((method) {
              final isSelected = _paymentMethod == method;
              final icons = {
                PaymentMethod.cash: Icons.payments_outlined,
                PaymentMethod.card: Icons.credit_card,
                PaymentMethod.transfer: Icons.swap_horiz,
                PaymentMethod.other: Icons.more_horiz,
              };
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    right: method != PaymentMethod.other ? 8 : 0,
                  ),
                  child: GestureDetector(
                    onTap: () =>
                        setState(() => _paymentMethod = method),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primary
                            : Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.cardBorder,
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            icons[method]!,
                            size: 20,
                            color: isSelected
                                ? Colors.white
                                : AppColors.textMuted,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            paymentMethodLabels[method.apiValue] ??
                                method.apiValue,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: isSelected
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                              color: isSelected
                                  ? Colors.white
                                  : AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 20),

          // ── Notes ──────────────────────────────────────────────────
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
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'Observaciones, comentarios...',
            ),
          ),
          const SizedBox(height: 32),

          // ── Submit ─────────────────────────────────────────────────
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
                      'Crear Registro',
                      style: TextStyle(fontSize: 16),
                    ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
