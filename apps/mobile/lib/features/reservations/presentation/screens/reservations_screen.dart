import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../infrastructure/reservation_repository_impl.dart';
import '../../domain/entities/reservation.dart';
import '../widgets/reservation_card.dart';

class ReservationsScreen extends StatefulWidget {
  const ReservationsScreen({super.key});

  @override
  State<ReservationsScreen> createState() => _ReservationsScreenState();
}

class _ReservationsScreenState extends State<ReservationsScreen> {
  final _repo = ReservationRepositoryImpl();
  late Future<List<Reservation>> _future;
  String? _selectedStatus;

  static const _statusOptions = [
    (label: 'Todas', value: null),
    (label: 'Pendientes', value: 'pending'),
    (label: 'Confirmadas', value: 'confirmed'),
    (label: 'En progreso', value: 'in_progress'),
    (label: 'Completadas', value: 'completed'),
    (label: 'Canceladas', value: 'cancelled'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = _repo
        .getAll(status: _selectedStatus)
        .then((result) => result.fold(
              (f) => throw f.message,
              (list) => list,
            ));
  }

  void _refresh({String? status}) {
    setState(() {
      _selectedStatus = status;
      _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis Reservaciones'),
        actions: [
          PopupMenuButton<String?>(
            icon: const Icon(Icons.filter_list),
            tooltip: 'Filtrar',
            onSelected: (v) => _refresh(status: v),
            itemBuilder: (_) => _statusOptions
                .map(
                  (o) => PopupMenuItem<String?>(
                    value: o.value,
                    child: Text(o.label),
                  ),
                )
                .toList(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => _refresh(status: _selectedStatus),
        child: FutureBuilder<List<Reservation>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: Colors.red),
                      const SizedBox(height: 12),
                      Text(
                        snapshot.error.toString(),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => _refresh(status: _selectedStatus),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                ),
              );
            }

            final reservations = snapshot.data ?? [];
            if (reservations.isEmpty) {
              return const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.calendar_today, size: 64, color: Colors.grey),
                    SizedBox(height: 16),
                    Text(
                      'No tienes reservaciones',
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.grey,
                      ),
                    ),
                  ],
                ),
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: reservations.length,
              itemBuilder: (context, index) {
                final reservation = reservations[index];
                return ReservationCard(
                  reservation: reservation,
                  onTap: () =>
                      context.push('/reservations/${reservation.id}'),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await context.push('/reservations/create');
          _refresh(status: _selectedStatus);
        },
        icon: const Icon(Icons.add),
        label: const Text('Nueva'),
      ),
    );
  }
}
