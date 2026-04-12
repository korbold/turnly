import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../domain/entities/vehicle.dart';
import '../../infrastructure/vehicle_repository_impl.dart';

class VehiclesScreen extends StatefulWidget {
  const VehiclesScreen({super.key});

  @override
  State<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends State<VehiclesScreen> {
  final _repo = VehicleRepositoryImpl();
  List<Vehicle> _vehicles = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await _repo.getAll();
    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _error = failure.message;
        _loading = false;
      }),
      (vehicles) => setState(() {
        _vehicles = vehicles;
        _loading = false;
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mis Vehículos')),
      body: Builder(builder: (_) {
        if (_loading) {
          return const Center(child: CircularProgressIndicator());
        }
        if (_error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(_error!, style: const TextStyle(color: Colors.red)),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _load,
                  child: const Text('Reintentar'),
                ),
              ],
            ),
          );
        }
        if (_vehicles.isEmpty) {
          return const Center(
            child: Text(
              'No tienes vehículos registrados.\nAgrega uno con el botón +.',
              textAlign: TextAlign.center,
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: _load,
          child: ListView.builder(
            itemCount: _vehicles.length,
            itemBuilder: (context, index) {
              final v = _vehicles[index];
              return _VehicleCard(
                vehicle: v,
                onTap: () => context.push(
                '/vehicles/${v.id}/history',
                extra: v.plate,
              ),
              );
            },
          ),
        );
      }),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await context.push('/vehicles/add');
          _load();
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _VehicleCard extends StatelessWidget {
  final Vehicle vehicle;
  final VoidCallback onTap;

  const _VehicleCard({required this.vehicle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final subtitle = [
      if (vehicle.brand != null) vehicle.brand!,
      if (vehicle.model != null) vehicle.model!,
      if (vehicle.color != null) vehicle.color!,
    ].join(' · ');

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: ListTile(
        leading: const Icon(Icons.directions_car, size: 36),
        title: Text(
          vehicle.plate,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: subtitle.isNotEmpty ? Text(subtitle) : null,
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
