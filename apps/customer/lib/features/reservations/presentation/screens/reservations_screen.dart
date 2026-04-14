// features/reservations/presentation/screens/reservations_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../infrastructure/reservation_repository_impl.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';
import '../widgets/reservation_card.dart';

class ReservationsScreen extends StatefulWidget {
  final VoidCallback? onNewReservation;
  const ReservationsScreen({super.key, this.onNewReservation});

  @override
  State<ReservationsScreen> createState() => _ReservationsScreenState();
}

class _ReservationsScreenState extends State<ReservationsScreen> {
  final _repo = ReservationRepositoryImpl();
  late Future<List<Reservation>> _future;
  int _selectedFilter = 0;

  static const _filters = ['Proximas', 'Completadas', 'Canceladas'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    String? status;
    switch (_selectedFilter) {
      case 1:
        status = 'completed';
        break;
      case 2:
        status = 'cancelled';
        break;
    }
    _future = _repo
        .getAll(status: status)
        .then((result) => result.fold((f) => throw f.message, (list) {
          if (_selectedFilter == 0) {
            return list.where((r) =>
              r.status == ReservationStatus.pending ||
              r.status == ReservationStatus.confirmed ||
              r.status == ReservationStatus.inProgress
            ).toList();
          }
          return list;
        }));
  }

  void _refresh({int? filter}) {
    setState(() {
      if (filter != null) _selectedFilter = filter;
      _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mis Citas')),
      body: Column(
        children: [
          // Filter chips
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Row(
              children: List.generate(_filters.length, (i) {
                final isActive = _selectedFilter == i;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () => _refresh(filter: i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isActive ? AppColors.primary : AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: isActive ? null : Border.all(color: AppColors.border, width: 0.5),
                      ),
                      child: Text(
                        _filters[i],
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: isActive ? Colors.white : AppColors.darkText,
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),

          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => _refresh(),
              child: FutureBuilder<List<Reservation>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                          const SizedBox(height: 12),
                          Text(snapshot.error.toString(), textAlign: TextAlign.center),
                          const SizedBox(height: 16),
                          OutlinedButton(onPressed: () => _refresh(), child: const Text('Reintentar')),
                        ],
                      ),
                    );
                  }

                  final reservations = snapshot.data ?? [];
                  if (reservations.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.calendar_today, size: 72, color: AppColors.border),
                          const SizedBox(height: 16),
                          const Text('No tenes citas', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.darkText)),
                          const SizedBox(height: 8),
                          OutlinedButton(
                            onPressed: widget.onNewReservation ?? () => context.go('/home'),
                            child: const Text('Explorar negocios'),
                          ),
                        ],
                      ),
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.only(bottom: 100),
                    itemCount: reservations.length,
                    itemBuilder: (context, i) {
                      final r = reservations[i];
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_selectedFilter == 0 && i == 0)
                            const Padding(
                              padding: EdgeInsets.fromLTRB(20, 8, 20, 4),
                              child: Text('Proxima cita', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.bodyText)),
                            ),
                          ReservationCard(
                            reservation: r,
                            isHighlighted: _selectedFilter == 0 && i == 0,
                            onTap: () => context.push('/reservations/${r.id}'),
                          ),
                        ],
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
