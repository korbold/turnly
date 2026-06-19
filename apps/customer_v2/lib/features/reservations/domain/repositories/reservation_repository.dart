// lib/features/reservations/domain/repositories/reservation_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../../../explore/domain/entities/service.dart';
import '../entities/reservation.dart';
import '../entities/available_slot.dart';
import '../entities/booking_item.dart';
import '../entities/reservation_item.dart';

abstract class ReservationRepository {
  Future<Either<Failure, List<Reservation>>> getAll({String? status});
  Future<Either<Failure, Reservation>> getById(String id);

  /// Legacy single-service booking. Kept for older entry points;
  /// new flows should use [createWithItems].
  Future<Either<Failure, Reservation>> create({
    required String tenantSlug,
    required String clientResourceId,
    required String serviceId,
    required String scheduledAt,
    String? notes,
    String? businessResourceId,
  });

  /// Multi-service booking. Backend expands each item to a
  /// reservation_items row and sums durations into estimated_end.
  Future<Either<Failure, Reservation>> createWithItems({
    required String tenantSlug,
    required String clientResourceId,
    required List<BookingItem> items,
    required String scheduledAt,
    String? notes,
    String? businessResourceId,
  });

  Future<Either<Failure, List<AvailableSlot>>> getAvailableSlots(
    String date,
    String serviceId, {
    int? durationMin,
    List<String>? variantIds,
    String? businessResourceId,
  });

  Future<Either<Failure, Unit>> cancel(String id, {String? reason});

  /// Customer-initiated reschedule. Same backend cooldown as cancel
  /// (>= cancellation_hours before the booking). Body sends only the
  /// new scheduled_at; backend recomputes estimated_end from items.
  Future<Either<Failure, Unit>> reschedule(String id, {required String scheduledAt});

  // Phase 3.5 — customer edits items on a pending/confirmed reservation.
  Future<Either<Failure, List<ReservationItem>>> listItems(String reservationId);
  Future<Either<Failure, ReservationItem>> addItem(
    String reservationId, {
    required String itemType,
    required String refId,
    int qty = 1,
  });
  Future<Either<Failure, Unit>> removeItem(String itemId);

  /// Phase 3.7 — backend picks the variant that fits the client's
  /// registered resource (vehicle, pet, etc.). Returns null when the
  /// tenant has no segmentation field, the resource lacks the value,
  /// or no variant label matches. Customer flow uses this right after
  /// the resource is selected so the size step can be skipped.
  Future<Either<Failure, ServiceVariantOption?>> fetchSuggestedVariant({
    required String serviceId,
    required String clientResourceId,
  });
}
