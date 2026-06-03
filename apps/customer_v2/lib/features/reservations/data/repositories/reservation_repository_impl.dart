// lib/features/reservations/data/repositories/reservation_repository_impl.dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../../explore/domain/entities/service.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/entities/available_slot.dart';
import '../../domain/entities/booking_item.dart';
import '../../domain/entities/reservation_item.dart';
import '../../domain/repositories/reservation_repository.dart';
import '../dtos/reservation_dto.dart';

class ReservationRepositoryImpl implements ReservationRepository {
  final Dio _dio = ApiClient.instance;

  @override
  Future<Either<Failure, List<Reservation>>> getAll({String? status}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null) queryParams['status'] = status;

      final response = await _dio.get(
        '/client/reservations',
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );

      final data = response.data['data'] as List<dynamic>;
      final reservations = data
          .map((e) => ReservationDto(e as Map<String, dynamic>).toEntity())
          .toList();
      return Right(reservations);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener reservas',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Reservation>> getById(String id) async {
    try {
      final response = await _dio.get('/client/reservations/$id');
      return Right(
        ReservationDto(response.data['data'] as Map<String, dynamic>).toEntity(),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        return const Left(NotFoundFailure('Reserva no encontrada'));
      }
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener reserva',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Reservation>> create({
    required String tenantSlug,
    required String clientResourceId,
    required String serviceId,
    required String scheduledAt,
    String? notes,
  }) async {
    try {
      final response = await _dio.post(
        '/public/tenants/$tenantSlug/book',
        data: {
          if (clientResourceId.isNotEmpty)
            'client_resource_id': clientResourceId,
          'service_id': serviceId,
          'scheduled_at': scheduledAt,
          if (notes != null) 'notes': notes,
        },
      );
      return Right(
        ReservationDto(response.data['data'] as Map<String, dynamic>).toEntity(),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(_extractError(e)));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Reservation>> createWithItems({
    required String tenantSlug,
    required String clientResourceId,
    required List<BookingItem> items,
    required String scheduledAt,
    String? notes,
  }) async {
    try {
      // Map cart items to the backend's items[] payload. When the
      // selection lacks a variant id (older catalogs) we fall back to
      // sending service_id alongside, so the server can resolve it.
      final payloadItems = items
          .where((i) =>
              i.serviceVariantId != null && i.serviceVariantId!.isNotEmpty)
          .map((i) => {
                'service_variant_id': i.serviceVariantId,
                'qty': i.qty,
              })
          .toList();

      final body = <String, dynamic>{
        if (clientResourceId.isNotEmpty)
          'client_resource_id': clientResourceId,
        'scheduled_at': scheduledAt,
        if (notes != null) 'notes': notes,
      };

      if (payloadItems.isNotEmpty) {
        body['items'] = payloadItems;
      } else if (items.isNotEmpty) {
        // No variants available — collapse to legacy single-service.
        body['service_id'] = items.first.serviceId;
      }

      final response = await _dio.post(
        '/public/tenants/$tenantSlug/book',
        data: body,
      );
      return Right(
        ReservationDto(response.data['data'] as Map<String, dynamic>).toEntity(),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(_extractError(e)));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  /// Pull the most useful message out of a Laravel/Dio error response:
  /// 1) `error.message` (custom domain errors)
  /// 2) `errors.<field>[0]` (default 422 validation shape)
  /// 3) top-level `message`
  /// 4) generic fallback
  String _extractError(DioException e) {
    final data = e.response?.data;
    if (data is Map) {
      final err = data['error'];
      if (err is Map && err['message'] is String) {
        return err['message'] as String;
      }
      final errors = data['errors'];
      if (errors is Map && errors.isNotEmpty) {
        final first = errors.values.first;
        if (first is List && first.isNotEmpty) return first.first.toString();
      }
      if (data['message'] is String) return data['message'] as String;
    }
    return 'Error al crear reserva';
  }

  @override
  Future<Either<Failure, List<AvailableSlot>>> getAvailableSlots(
    String date,
    String serviceId, {
    int? durationMin,
    List<String>? variantIds,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'date': date,
        'service_id': serviceId,
      };
      if (durationMin != null) queryParams['duration_min'] = durationMin;
      if (variantIds != null && variantIds.isNotEmpty) {
        queryParams['variant_ids'] = variantIds;
      }

      final response = await _dio.get(
        '/reservations/available-slots',
        queryParameters: queryParams,
      );

      final data = response.data['data'] as List<dynamic>;
      final slots = data.map((e) {
        final map = e as Map<String, dynamic>;
        return AvailableSlot(
          start: DateTime.parse(map['start'] as String),
          end: DateTime.parse(map['end'] as String),
          available: map['available'] as int,
        );
      }).toList();
      return Right(slots);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener horarios',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, List<ReservationItem>>> listItems(String reservationId) async {
    try {
      final response = await _dio.get('/client/reservations/$reservationId/items');
      final data = response.data['data'] as List<dynamic>;
      return Right(
        data.map((e) => ReservationItem.fromJson(e as Map<String, dynamic>)).toList(),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener items',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, ReservationItem>> addItem(
    String reservationId, {
    required String itemType,
    required String refId,
    int qty = 1,
  }) async {
    try {
      final response = await _dio.post(
        '/client/reservations/$reservationId/items',
        data: {
          'item_type': itemType,
          'ref_id': refId,
          'qty': qty,
        },
      );
      return Right(
        ReservationItem.fromJson(response.data['data'] as Map<String, dynamic>),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'No se pudo agregar',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> removeItem(String itemId) async {
    try {
      await _dio.delete('/client/reservation-items/$itemId');
      return const Right(unit);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'No se pudo eliminar',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, ServiceVariantOption?>> fetchSuggestedVariant({
    required String serviceId,
    required String clientResourceId,
  }) async {
    try {
      final response = await _dio.get(
        '/public/services/$serviceId/suggested-variant',
        queryParameters: {'resource_id': clientResourceId},
      );
      final raw = response.data['data'];
      if (raw == null) return const Right(null);
      final v = raw as Map<String, dynamic>;
      // Backend exposes the matched variant under `variant_id`; accept
      // plain `id` too so future API shapes don't break the client.
      final id = (v['variant_id'] ?? v['id']) as String?;
      if (id == null || id.isEmpty) return const Right(null);
      final price = v['price'];
      return Right(ServiceVariantOption(
        id: id,
        label: v['label'] as String? ?? '',
        price: price is num
            ? price.toDouble()
            : double.tryParse(price?.toString() ?? '0') ?? 0.0,
        durationMin: (v['duration_min'] as num?)?.toInt() ?? 0,
        sortOrder: (v['sort_order'] as num?)?.toInt() ?? 0,
      ));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return const Right(null);
    } catch (_) {
      return const Right(null);
    }
  }

  @override
  Future<Either<Failure, Unit>> cancel(String id, {String? reason}) async {
    try {
      await _dio.patch('/client/reservations/$id/cancel', data: {
        if (reason != null) 'reason': reason,
      });
      return const Right(unit);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al cancelar reserva',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
