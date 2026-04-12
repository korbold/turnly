import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';
import '../../infrastructure/reservation_repository_impl.dart';
import '../widgets/reservation_card.dart';

class ReservationsScreen extends StatefulWidget {
  const ReservationsScreen({super.key});

  @override
  State<ReservationsScreen> createState() => _ReservationsScreenState();
}

class _ReservationsScreenState extends State<ReservationsScreen> {
  final _repo = ReservationRepositoryImpl();

  DateTime _selectedDate = DateTime.now();
  String? _selectedStatus;
  List<Reservation> _reservations = [];
  bool _loading = true;
  String? _error;

  static const _statusOptions = <String?, String>{
    null: 'Todos',
    'pending': 'Pendiente',
    'confirmed': 'Confirmada',
    'in_progress': 'En progreso',
    'completed': 'Completada',
    'cancelled': 'Cancelada',
  };

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  String get _dateStr => DateFormat('yyyy-MM-dd').format(_selectedDate);

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final result = await _repo.getAll(date: _dateStr, status: _selectedStatus);

    if (!mounted) return;
    setState(() {
      _loading = false;
      result.fold(
        (f) => _error = f.message,
        (list) => _reservations = list,
      );
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2024),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null && mounted) {
      setState(() => _selectedDate = picked);
      _loadData();
    }
  }

  Future<void> _doAction(Future<void> Function() action) async {
    await action();
    if (mounted) _loadData();
  }

  Future<void> _confirmReservation(String id) async {
    await _doAction(() async {
      final result = await _repo.confirm(id);
      if (!mounted) return;
      result.fold(
        (f) => _showError(f.message),
        (_) {},
      );
    });
  }

  Future<void> _startReservation(String id) async {
    await _doAction(() async {
      final result = await _repo.start(id);
      if (!mounted) return;
      result.fold(
        (f) => _showError(f.message),
        (_) {},
      );
    });
  }

  Future<void> _completeReservation(String id) async {
    await _doAction(() async {
      final result = await _repo.complete(id);
      if (!mounted) return;
      result.fold(
        (f) => _showError(f.message),
        (_) {},
      );
    });
  }

  Future<void> _cancelReservation(String id) async {
    final reason = await _showCancelDialog();
    if (reason == null) return; // User cancelled the dialog
    await _doAction(() async {
      final result = await _repo.cancel(id, reason: reason.isNotEmpty ? reason : null);
      if (!mounted) return;
      result.fold(
        (f) => _showError(f.message),
        (_) {},
      );
    });
  }

  Future<String?> _showCancelDialog() async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancelar reservación'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Motivo (opcional)',
            hintText: 'Ingresa el motivo de cancelación',
          ),
          maxLines: 2,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Volver')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Cancelar reservación'),
          ),
        ],
      ),
    );
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reservaciones'),
        actions: [
          // Date picker button
          TextButton.icon(
            onPressed: _pickDate,
            icon: const Icon(Icons.calendar_today, size: 18),
            label: Text(DateFormat('d MMM').format(_selectedDate)),
          ),
          // Status filter
          PopupMenuButton<String?>(
            icon: const Icon(Icons.filter_list),
            tooltip: 'Filtrar por estado',
            initialValue: _selectedStatus,
            onSelected: (value) {
              setState(() => _selectedStatus = value);
              _loadData();
            },
            itemBuilder: (_) => _statusOptions.entries
                .map((e) => PopupMenuItem<String?>(
                      value: e.key,
                      child: Row(
                        children: [
                          if (_selectedStatus == e.key)
                            const Icon(Icons.check, size: 16, color: Colors.blue)
                          else
                            const SizedBox(width: 16),
                          const SizedBox(width: 8),
                          Text(e.value),
                        ],
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _loadData, child: const Text('Reintentar')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: _reservations.isEmpty
                      ? ListView(
                          children: [
                            SizedBox(
                              height: 300,
                              child: Center(
                                child: Text(
                                  'No hay reservaciones',
                                  style: TextStyle(color: Colors.grey.shade600),
                                ),
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          itemCount: _reservations.length,
                          itemBuilder: (context, index) {
                            final r = _reservations[index];
                            return ReservationCard(
                              reservation: r,
                              onTap: () => context.push('/reservations/${r.id}'),
                              onConfirm: r.status == ReservationStatus.pending
                                  ? () => _confirmReservation(r.id)
                                  : null,
                              onStart: r.status == ReservationStatus.confirmed
                                  ? () => _startReservation(r.id)
                                  : null,
                              onComplete: r.status == ReservationStatus.inProgress
                                  ? () => _completeReservation(r.id)
                                  : null,
                              onCancel: (r.status == ReservationStatus.pending ||
                                      r.status == ReservationStatus.confirmed)
                                  ? () => _cancelReservation(r.id)
                                  : null,
                            );
                          },
                        ),
                ),
    );
  }
}
