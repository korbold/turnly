import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../domain/enums/payment_method.dart';
import '../../infrastructure/wash_log_repository_impl.dart';

class _Vehicle {
  final String id;
  final String plate;
  final String? brand;
  _Vehicle({required this.id, required this.plate, this.brand});
}

class _Service {
  final String id;
  final String name;
  final double price;
  _Service({required this.id, required this.name, required this.price});
}

class _User {
  final String id;
  final String name;
  _User({required this.id, required this.name});
}

class RegisterWashScreen extends StatefulWidget {
  const RegisterWashScreen({super.key});

  @override
  State<RegisterWashScreen> createState() => _RegisterWashScreenState();
}

class _RegisterWashScreenState extends State<RegisterWashScreen> {
  final _formKey = GlobalKey<FormState>();
  final _repo = WashLogRepositoryImpl();
  final _dio = DioClient.instance;

  List<_Vehicle> _vehicles = [];
  List<_Service> _services = [];
  List<_User> _users = [];

  _Vehicle? _selectedVehicle;
  _Service? _selectedService;
  _User? _selectedUser;
  PaymentMethod _selectedPayment = PaymentMethod.cash;

  final _priceController = TextEditingController();
  final _notesController = TextEditingController();

  bool _loadingData = true;
  bool _submitting = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _loadDropdownData();
  }

  @override
  void dispose() {
    _priceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadDropdownData() async {
    setState(() { _loadingData = true; _loadError = null; });
    try {
      final currentUserId = await SecureStorage.getUserId();

      final results = await Future.wait([
        _dio.get('/vehicles', queryParameters: {'per_page': 200}),
        _dio.get('/services', queryParameters: {'per_page': 100}),
        _dio.get('/users', queryParameters: {'per_page': 100}),
      ]);

      final vehiclesData = results[0].data['data'] as List<dynamic>;
      final servicesData = results[1].data['data'] as List<dynamic>;
      final usersData = results[2].data['data'] as List<dynamic>;

      final vehicles = vehiclesData.map((v) {
        final m = v as Map<String, dynamic>;
        return _Vehicle(
          id: m['id'] as String,
          plate: m['plate'] as String,
          brand: m['brand'] as String?,
        );
      }).toList();

      final services = servicesData.map((s) {
        final m = s as Map<String, dynamic>;
        return _Service(
          id: m['id'] as String,
          name: m['name'] as String,
          price: double.parse(m['price'].toString()),
        );
      }).toList();

      final users = usersData.map((u) {
        final m = u as Map<String, dynamic>;
        return _User(
          id: m['id'] as String,
          name: m['name'] as String,
        );
      }).toList();

      _User? defaultUser;
      if (currentUserId != null) {
        try {
          defaultUser = users.firstWhere((u) => u.id == currentUserId);
        } catch (_) {
          defaultUser = users.isNotEmpty ? users.first : null;
        }
      }

      setState(() {
        _vehicles = vehicles;
        _services = services;
        _users = users;
        _selectedUser = defaultUser;
        _loadingData = false;
      });
    } on DioException catch (e) {
      setState(() {
        _loadError = e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar datos';
        _loadingData = false;
      });
    } catch (e) {
      setState(() {
        _loadError = e.toString();
        _loadingData = false;
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedVehicle == null || _selectedService == null || _selectedUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona vehículo, servicio y lavador')),
      );
      return;
    }

    setState(() => _submitting = true);

    final result = await _repo.create(
      vehicleId: _selectedVehicle!.id,
      serviceId: _selectedService!.id,
      attendedBy: _selectedUser!.id,
      priceCharged: double.parse(_priceController.text),
      paymentMethod: _selectedPayment.apiValue,
      notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
    );

    if (!mounted) return;

    result.fold(
      (f) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message)));
      },
      (_) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lavado registrado'), backgroundColor: Colors.green),
        );
        context.pop();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Registrar Lavado')),
      body: _loadingData
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_loadError!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 8),
                      ElevatedButton(onPressed: _loadDropdownData, child: const Text('Reintentar')),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Vehicle
                        DropdownButtonFormField<_Vehicle>(
                          value: _selectedVehicle,
                          decoration: const InputDecoration(
                            labelText: 'Vehículo',
                            border: OutlineInputBorder(),
                          ),
                          items: _vehicles.map((v) {
                            return DropdownMenuItem(
                              value: v,
                              child: Text(
                                v.brand != null ? '${v.plate} — ${v.brand}' : v.plate,
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }).toList(),
                          onChanged: (v) => setState(() => _selectedVehicle = v),
                          validator: (v) => v == null ? 'Selecciona un vehículo' : null,
                        ),
                        const SizedBox(height: 16),
                        // Service
                        DropdownButtonFormField<_Service>(
                          value: _selectedService,
                          decoration: const InputDecoration(
                            labelText: 'Servicio',
                            border: OutlineInputBorder(),
                          ),
                          items: _services.map((s) {
                            return DropdownMenuItem(
                              value: s,
                              child: Text(
                                '${s.name} — \$${s.price.toStringAsFixed(2)}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }).toList(),
                          onChanged: (s) {
                            setState(() {
                              _selectedService = s;
                              if (s != null) {
                                _priceController.text = s.price.toStringAsFixed(2);
                              }
                            });
                          },
                          validator: (v) => v == null ? 'Selecciona un servicio' : null,
                        ),
                        const SizedBox(height: 16),
                        // Attendant
                        DropdownButtonFormField<_User>(
                          value: _selectedUser,
                          decoration: const InputDecoration(
                            labelText: 'Lavador',
                            border: OutlineInputBorder(),
                          ),
                          items: _users.map((u) {
                            return DropdownMenuItem(
                              value: u,
                              child: Text(u.name, overflow: TextOverflow.ellipsis),
                            );
                          }).toList(),
                          onChanged: (u) => setState(() => _selectedUser = u),
                          validator: (v) => v == null ? 'Selecciona un lavador' : null,
                        ),
                        const SizedBox(height: 16),
                        // Payment method
                        DropdownButtonFormField<PaymentMethod>(
                          value: _selectedPayment,
                          decoration: const InputDecoration(
                            labelText: 'Método de pago',
                            border: OutlineInputBorder(),
                          ),
                          items: PaymentMethod.values.map((m) {
                            return DropdownMenuItem(value: m, child: Text(m.label));
                          }).toList(),
                          onChanged: (m) => setState(() => _selectedPayment = m!),
                        ),
                        const SizedBox(height: 16),
                        // Price
                        TextFormField(
                          controller: _priceController,
                          decoration: const InputDecoration(
                            labelText: 'Precio',
                            prefixText: '\$',
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          validator: (v) {
                            if (v == null || v.isEmpty) return 'Ingresa un precio';
                            final parsed = double.tryParse(v);
                            if (parsed == null || parsed < 0) return 'Precio inválido';
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        // Notes
                        TextFormField(
                          controller: _notesController,
                          decoration: const InputDecoration(
                            labelText: 'Notas (opcional)',
                            border: OutlineInputBorder(),
                          ),
                          maxLines: 3,
                        ),
                        const SizedBox(height: 24),
                        // Submit
                        ElevatedButton(
                          onPressed: _submitting ? null : _submit,
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                          child: _submitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Registrar Lavado', style: TextStyle(fontSize: 16)),
                        ),
                      ],
                    ),
                  ),
                ),
    );
  }
}
