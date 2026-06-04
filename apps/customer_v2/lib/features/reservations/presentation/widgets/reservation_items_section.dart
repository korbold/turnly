// lib/features/reservations/presentation/widgets/reservation_items_section.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../explore/domain/entities/business.dart';
import '../../../explore/domain/entities/service.dart';
import '../../../explore/domain/repositories/explore_repository.dart';
import '../../domain/entities/reservation_item.dart';
import '../../domain/enums/reservation_status.dart';
import '../../domain/repositories/reservation_repository.dart';

/// Customer-facing items panel: lists the reservation's items + lets
/// the customer add/remove them while the reservation is still
/// pending or confirmed.
class ReservationItemsSection extends StatefulWidget {
  final String reservationId;
  final String? tenantSlug;
  final ReservationStatus status;
  final DateTime scheduledAt;

  const ReservationItemsSection({
    super.key,
    required this.reservationId,
    required this.status,
    required this.scheduledAt,
    this.tenantSlug,
  });

  @override
  State<ReservationItemsSection> createState() => _ReservationItemsSectionState();
}

class _ReservationItemsSectionState extends State<ReservationItemsSection> {
  List<ReservationItem> _items = [];
  bool _loading = true;
  bool _busy = false;
  String? _error;

  /// 30-minute pre-slot lock, mirrors the backend rule. Computed lazily
  /// so the button reflects the *current* time, not when the screen
  /// was first opened.
  bool get _withinCooldown {
    final minutes = widget.scheduledAt.difference(DateTime.now()).inMinutes;
    return minutes < 30;
  }

  bool get _canEdit =>
      (widget.status == ReservationStatus.pending ||
              widget.status == ReservationStatus.confirmed) &&
          !_withinCooldown;

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
    final result = await getIt<ReservationRepository>().listItems(widget.reservationId);
    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _error = failure.message;
        _loading = false;
      }),
      (items) => setState(() {
        _items = items;
        _loading = false;
      }),
    );
  }

  Future<void> _confirmRemove(ReservationItem item) async {
    final serviceLines = _items.where((i) => i.itemType == 'service_variant').length;
    if (item.itemType == 'service_variant' && serviceLines <= 1) {
      _toast('Tu reserva debe tener al menos un servicio. Cancélala si quieres dejarla sin servicios.');
      return;
    }
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Quitar item'),
        content: Text('¿Quitar "${item.label}" de tu reserva?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Quitar'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _busy = true);
    final res = await getIt<ReservationRepository>().removeItem(item.id);
    if (!mounted) return;
    res.fold(
      (failure) => _toast(failure.message),
      (_) {
        setState(() => _items.removeWhere((i) => i.id == item.id));
      },
    );
    setState(() => _busy = false);
  }

  Future<void> _openAddSheet() async {
    if (widget.tenantSlug == null) return;
    final repo = getIt<ExploreRepository>();
    final result = await repo.getBusinessBySlug(widget.tenantSlug!);
    if (!mounted) return;

    final Business? business = result.fold(
      (failure) {
        _toast(failure.message);
        return null;
      },
      (b) => b,
    );
    if (business == null) return;

    if (business.services.isEmpty) {
      _toast('No hay servicios disponibles.');
      return;
    }

    // Set of service IDs already in the cart so we can mark them as
    // "Ya agregado" instead of letting the user double-add the same
    // service (which would also fail on the backend uuid lookup when
    // the catalog only knows about variants).
    final addedServiceIds = _items
        .map((i) => i.serviceId)
        .whereType<String>()
        .toSet();

    if (!mounted) return;
    final selectedService = await showModalBottomSheet<Service>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Agregar servicio',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: business.services.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final s = business.services[i];
                      final alreadyAdded = addedServiceIds.contains(s.id);
                      final priceLabel = s.hasVariants
                          ? 'Desde \$${s.displayPrice.toStringAsFixed(2)}'
                          : '\$${s.price.toStringAsFixed(2)}';
                      return ListTile(
                        enabled: !alreadyAdded,
                        title: Text(s.name),
                        subtitle: Text(
                          alreadyAdded
                              ? 'Ya agregado'
                              : '$priceLabel · ${s.durationMinutes} min',
                          style: TextStyle(
                            fontSize: 12,
                            color: alreadyAdded ? AppColors.textTertiary : null,
                          ),
                        ),
                        trailing: alreadyAdded
                            ? const Icon(Icons.check_circle, color: Colors.green, size: 20)
                            : const Icon(Icons.add_circle_outline, size: 20),
                        onTap: alreadyAdded
                            ? null
                            : () => Navigator.pop(sheetCtx, s),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (selectedService == null || !mounted) return;

    String refId;
    if (selectedService.hasVariants) {
      final picked = await _pickVariant(selectedService);
      if (picked == null) return;
      refId = picked.id;
    } else {
      _toast('Este servicio no tiene variantes configuradas.');
      return;
    }

    setState(() => _busy = true);
    final res = await getIt<ReservationRepository>().addItem(
      widget.reservationId,
      itemType: 'service_variant',
      refId: refId,
    );
    if (!mounted) return;
    res.fold(
      (failure) => _toast(failure.message),
      (item) => setState(() => _items.add(item)),
    );
    setState(() => _busy = false);
  }

  Future<ServiceVariantOption?> _pickVariant(Service service) {
    return showModalBottomSheet<ServiceVariantOption>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  service.name,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Elige una opción',
                  style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 12),
                ...service.variants.map(
                  (v) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(v.label),
                    subtitle: Text(
                      '\$${v.price.toStringAsFixed(2)} · ${v.durationMin} min',
                      style: const TextStyle(fontSize: 12),
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => Navigator.pop(sheetCtx, v),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: LinearProgressIndicator(minHeight: 1),
      );
    }
    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Text(_error!, style: const TextStyle(color: AppColors.error)),
      );
    }
    if (_items.isEmpty && !_canEdit) {
      return const SizedBox.shrink();
    }

    final money = NumberFormat.simpleCurrency(name: 'USD');
    final total = _items.fold<num>(0, (acc, it) => acc + it.lineTotal);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.list_alt_rounded, size: 18, color: AppColors.textSecondary),
              const SizedBox(width: 8),
              const Text(
                'Servicios incluidos',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.textTertiary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              if (!_canEdit && _withinCooldown)
                const Text(
                  'Bloqueado · cerca del horario',
                  style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
                ),
            ],
          ),
          const SizedBox(height: 10),
          for (final it in _items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      it.qty > 1 ? '${it.label} × ${it.qty}' : it.label,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(money.format(it.lineTotal), style: const TextStyle(fontSize: 14)),
                  if (_canEdit)
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: _busy ? null : () => _confirmRemove(it),
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
            ),
          if (_canEdit) ...[
            const SizedBox(height: 4),
            TextButton.icon(
              onPressed: _busy ? null : _openAddSheet,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Agregar otro servicio'),
              style: TextButton.styleFrom(padding: EdgeInsets.zero, alignment: Alignment.centerLeft),
            ),
          ],
          if (_items.isNotEmpty) ...[
            const Divider(height: 20),
            Row(
              children: [
                const Text(
                  'Total',
                  style: TextStyle(fontSize: 14, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                Text(
                  money.format(total),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
