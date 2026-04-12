import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';
import '../../infrastructure/reservation_repository_impl.dart';
import '../widgets/status_badge.dart';

class ReservationDetailScreen extends StatefulWidget {
  final String reservationId;

  const ReservationDetailScreen({super.key, required this.reservationId});

  @override
  State<ReservationDetailScreen> createState() => _ReservationDetailScreenState();
}

class _ReservationDetailScreenState extends State<ReservationDetailScreen> {
  final _repo = ReservationRepositoryImpl();
  Reservation? _reservation;
  bool _loading = true;
  String? _error;
  bool _actionLoading = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final result = await _repo.getById(widget.reservationId);

    if (!mounted) return;
    setState(() {
      _loading = false;
      result.fold(
        (f) => _error = f.message,
        (r) => _reservation = r,
      );
    });
  }

  Future<void> _doAction(Future<dynamic> Function() action) async {
    setState(() => _actionLoading = true);
    await action();
    if (mounted) {
      setState(() => _actionLoading = false);
      await _loadData();
    }
  }

  Future<void> _confirm() => _doAction(() async {
        final result = await _repo.confirm(widget.reservationId);
        if (!mounted) return;
        result.fold((f) => _showSnack(f.message), (_) => _showSnack('Reservación confirmada'));
      });

  Future<void> _start() => _doAction(() async {
        final result = await _repo.start(widget.reservationId);
        if (!mounted) return;
        result.fold((f) => _showSnack(f.message), (_) => _showSnack('Servicio iniciado'));
      });

  Future<void> _complete() => _doAction(() async {
        final result = await _repo.complete(widget.reservationId);
        if (!mounted) return;
        result.fold((f) => _showSnack(f.message), (_) => _showSnack('Reservación completada'));
      });

  Future<void> _cancel() async {
    final reason = await _showCancelDialog();
    if (reason == null) return;
    await _doAction(() async {
      final result = await _repo.cancel(widget.reservationId, reason: reason.isNotEmpty ? reason : null);
      if (!mounted) return;
      result.fold((f) => _showSnack(f.message), (_) => _showSnack('Reservación cancelada'));
    });
  }

  Future<String?> _showCancelDialog() {
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

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalle de reservación'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
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
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final r = _reservation!;
    final timeFormatter = DateFormat('HH:mm');
    final dateFormatter = DateFormat('EEEE, d MMMM yyyy', 'es');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Status + scheduled time header
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                StatusBadge(status: r.status),
                const SizedBox(height: 12),
                Text(
                  dateFormatter.format(r.scheduledAt),
                  style: Theme.of(context).textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.access_time, size: 16, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(
                      '${timeFormatter.format(r.scheduledAt)} – ${timeFormatter.format(r.estimatedEnd)}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // Client info
        _SectionCard(
          title: 'Cliente',
          icon: Icons.person_outline,
          children: [
            _InfoRow(label: 'Nombre', value: r.clientName ?? '—'),
          ],
        ),
        const SizedBox(height: 12),

        // Vehicle info
        _SectionCard(
          title: 'Vehículo',
          icon: Icons.directions_car_outlined,
          children: [
            _InfoRow(label: 'Placa', value: r.vehiclePlate ?? '—'),
            if (r.vehicleBrand != null) _InfoRow(label: 'Marca', value: r.vehicleBrand!),
          ],
        ),
        const SizedBox(height: 12),

        // Service info
        _SectionCard(
          title: 'Servicio',
          icon: Icons.event_available,
          children: [
            _InfoRow(label: 'Servicio', value: r.serviceName ?? '—'),
            if (r.servicePrice != null) _InfoRow(label: 'Precio', value: '\$${r.servicePrice}'),
          ],
        ),

        // Notes
        if (r.notes != null && r.notes!.isNotEmpty) ...[
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Notas',
            icon: Icons.notes,
            children: [
              Text(r.notes!, style: const TextStyle(fontSize: 14)),
            ],
          ),
        ],

        // Action buttons
        const SizedBox(height: 20),
        if (_actionLoading)
          const Center(child: CircularProgressIndicator())
        else
          _buildActionButtons(r),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildActionButtons(Reservation r) {
    switch (r.status) {
      case ReservationStatus.pending:
        return Column(
          children: [
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _confirm,
                icon: const Icon(Icons.check),
                label: const Text('Confirmar reservación'),
                style: FilledButton.styleFrom(backgroundColor: Colors.green),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _cancel,
                icon: const Icon(Icons.cancel_outlined),
                label: const Text('Cancelar reservación'),
                style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
              ),
            ),
          ],
        );
      case ReservationStatus.confirmed:
        return Column(
          children: [
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _start,
                icon: const Icon(Icons.play_arrow),
                label: const Text('Iniciar servicio'),
                style: FilledButton.styleFrom(backgroundColor: Colors.blue),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _cancel,
                icon: const Icon(Icons.cancel_outlined),
                label: const Text('Cancelar reservación'),
                style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
              ),
            ),
          ],
        );
      case ReservationStatus.inProgress:
        return SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _complete,
            icon: const Icon(Icons.check_circle),
            label: const Text('Completar servicio'),
            style: FilledButton.styleFrom(backgroundColor: Colors.green),
          ),
        );
      case ReservationStatus.completed:
      case ReservationStatus.cancelled:
      case ReservationStatus.noShow:
        return const SizedBox.shrink();
    }
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _SectionCard({required this.title, required this.icon, required this.children});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: Colors.grey),
                const SizedBox(width: 8),
                Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
              ],
            ),
            const Divider(height: 16),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(label, style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
        ],
      ),
    );
  }
}
