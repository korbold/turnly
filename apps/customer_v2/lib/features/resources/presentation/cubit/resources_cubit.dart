// lib/features/resources/presentation/cubit/resources_cubit.dart
import 'dart:developer' as dev;
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/error/failures.dart';
import '../../domain/repositories/resource_repository.dart';
import 'resources_state.dart';

class ResourcesCubit extends Cubit<ResourcesState> {
  final ResourceRepository _repository;

  ResourcesCubit(this._repository) : super(const ResourcesInitial());

  Future<void> loadResources() async {
    emit(const ResourcesLoading());
    final result = await _repository.getAll();
    result.fold(
      (failure) => emit(ResourcesError(failure.message)),
      (resources) => emit(ResourcesLoaded(resources)),
    );
  }

  Future<bool> createResource({
    required String label,
    Map<String, dynamic>? data,
  }) async {
    dev.log('[ResourcesCubit] createResource label=$label data=$data');
    final result = await _repository.create(label: label, data: data);
    result.fold(
      (failure) => dev.log('[ResourcesCubit] CREATE FAILED: ${failure.message}'),
      (resource) => dev.log('[ResourcesCubit] CREATE OK: ${resource.id}'),
    );
    if (result.isRight()) {
      await loadResources();
      return true;
    }
    return false;
  }

  Future<bool> updateResource({required String id, Map<String, dynamic>? data}) async {
    dev.log('[ResourcesCubit] updateResource id=$id data=$data');
    final result = await _repository.update(id: id, data: data);
    if (result.isRight()) {
      await loadResources();
      return true;
    }
    return false;
  }

  /// Devuelve `null` si se borró, o el fallo para que la pantalla decida qué
  /// hacer con él. Antes devolvía un bool: un borrado rechazado se veía igual
  /// que uno exitoso —nada en pantalla, el vehículo seguía ahí— y el cliente
  /// no tenía forma de saber que su historial era el que lo impedía.
  Future<Failure?> deleteResource(String id) async {
    dev.log('[ResourcesCubit] deleteResource id=$id');
    final result = await _repository.delete(id);
    if (result.isRight()) {
      await loadResources();
      return null;
    }
    return result.fold((f) => f, (_) => null);
  }

  /// Saca el vehículo de la lista sin borrarlo. El local conserva su historial.
  Future<Failure?> releaseResource(String id) async {
    dev.log('[ResourcesCubit] releaseResource id=$id');
    final result = await _repository.release(id);
    if (result.isRight()) {
      await loadResources();
      return null;
    }
    return result.fold((f) => f, (_) => null);
  }
}
