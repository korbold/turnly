// lib/features/reservations/presentation/cubit/create_reservation_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/booking_item.dart';
import '../../domain/repositories/reservation_repository.dart';
import 'create_reservation_state.dart';

class CreateReservationCubit extends Cubit<CreateReservationState> {
  final ReservationRepository _repository;

  final List<BookingItem> _cart = [];
  int _cartVersion = 0;

  CreateReservationCubit(this._repository)
      : super(const CreateReservationInitial());

  List<BookingItem> get cart => List.unmodifiable(_cart);
  int get totalDurationMin =>
      _cart.fold(0, (acc, it) => acc + it.durationMin * it.qty);
  double get totalPrice => _cart.fold(0, (acc, it) => acc + it.lineTotal);

  void _emitCart() => emit(CreateReservationInitial(version: ++_cartVersion));

  void seedCart(List<BookingItem> items) {
    _cart
      ..clear()
      ..addAll(items);
    _emitCart();
  }

  void addToCart(BookingItem item) {
    final existing = _cart.indexWhere(
      (i) =>
          i.serviceId == item.serviceId &&
          i.serviceVariantId == item.serviceVariantId,
    );
    if (existing >= 0) {
      _cart[existing] = _cart[existing].copyWith(qty: _cart[existing].qty + 1);
    } else {
      _cart.add(item);
    }
    _emitCart();
  }

  void removeFromCart(int index) {
    if (index < 0 || index >= _cart.length) return;
    _cart.removeAt(index);
    _emitCart();
  }

  Future<void> loadSlots(
    String date,
    String serviceId, {
    String? businessResourceId,
  }) async {
    emit(const CreateReservationLoadingSlots());
    final variantIds = _cart
        .where((i) => i.serviceVariantId != null)
        .map((i) => i.serviceVariantId!)
        .toList();
    final result = await _repository.getAvailableSlots(
      date,
      serviceId,
      durationMin: totalDurationMin > 0 ? totalDurationMin : null,
      variantIds: variantIds.isNotEmpty ? variantIds : null,
      businessResourceId: businessResourceId,
    );
    result.fold(
      (failure) => emit(CreateReservationError(failure.message)),
      (slots) => emit(CreateReservationSlotsLoaded(slots)),
    );
  }

  Future<void> createReservation({
    required String tenantSlug,
    String? clientResourceId,
    String? businessResourceId,
    required String serviceId,
    required String scheduledAt,
    String? notes,
  }) async {
    emit(const CreateReservationSubmitting());

    if (_cart.isNotEmpty) {
      final result = await _repository.createWithItems(
        tenantSlug: tenantSlug,
        clientResourceId: clientResourceId ?? '',
        items: _cart,
        scheduledAt: scheduledAt,
        notes: notes,
        businessResourceId: businessResourceId,
      );
      result.fold(
        (failure) => emit(CreateReservationError(failure.message)),
        (reservation) => emit(CreateReservationSuccess(reservation)),
      );
      return;
    }

    final result = await _repository.create(
      tenantSlug: tenantSlug,
      clientResourceId: clientResourceId ?? '',
      serviceId: serviceId,
      scheduledAt: scheduledAt,
      notes: notes,
      businessResourceId: businessResourceId,
    );
    result.fold(
      (failure) => emit(CreateReservationError(failure.message)),
      (reservation) => emit(CreateReservationSuccess(reservation)),
    );
  }
}
