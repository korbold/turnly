// lib/features/reservations/presentation/cubit/create_reservation_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/booking_item.dart';
import '../../domain/repositories/reservation_repository.dart';
import 'create_reservation_state.dart';

class CreateReservationCubit extends Cubit<CreateReservationState> {
  final ReservationRepository _repository;

  /// Cart of services the customer is booking in this session. The first
  /// item is seeded by `business_detail_screen` when the user taps a
  /// service card; "+ Agregar servicio" appends more entries.
  final List<BookingItem> _cart = [];

  /// Bumped on every cart mutation so two `Initial` states aren't equal
  /// under Equatable; otherwise `emit` would no-op and BlocBuilder
  /// wouldn't rebuild the summary panel.
  int _cartVersion = 0;

  CreateReservationCubit(this._repository)
      : super(const CreateReservationInitial());

  List<BookingItem> get cart => List.unmodifiable(_cart);
  int get totalDurationMin =>
      _cart.fold(0, (acc, it) => acc + it.durationMin * it.qty);
  double get totalPrice =>
      _cart.fold(0, (acc, it) => acc + it.lineTotal);

  void _emitCart() => emit(CreateReservationInitial(version: ++_cartVersion));

  void seedCart(List<BookingItem> items) {
    _cart
      ..clear()
      ..addAll(items);
    _emitCart();
  }

  void addToCart(BookingItem item) {
    final existing = _cart.indexWhere(
      (i) => i.serviceId == item.serviceId &&
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

  Future<void> loadSlots(String date, String serviceId) async {
    emit(const CreateReservationLoadingSlots());
    final variantIds = _cart
        .where((i) => i.serviceVariantId != null)
        .map((i) => i.serviceVariantId!)
        .toList();
    final result = await _repository.getAvailableSlots(
      date,
      serviceId,
      // When the cart has variants we ask the backend to size each slot
      // to the *total* duration of the booking.
      durationMin: totalDurationMin > 0 ? totalDurationMin : null,
      variantIds: variantIds.isNotEmpty ? variantIds : null,
    );
    result.fold(
      (failure) => emit(CreateReservationError(failure.message)),
      (slots) => emit(CreateReservationSlotsLoaded(slots)),
    );
  }

  Future<void> createReservation({
    required String tenantSlug,
    String? clientResourceId,
    required String serviceId,
    required String scheduledAt,
    String? notes,
  }) async {
    emit(const CreateReservationSubmitting());

    // Prefer the multi-service endpoint whenever the cart has entries.
    if (_cart.isNotEmpty) {
      final result = await _repository.createWithItems(
        tenantSlug: tenantSlug,
        clientResourceId: clientResourceId ?? '',
        items: _cart,
        scheduledAt: scheduledAt,
        notes: notes,
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
    );
    result.fold(
      (failure) => emit(CreateReservationError(failure.message)),
      (reservation) => emit(CreateReservationSuccess(reservation)),
    );
  }
}
