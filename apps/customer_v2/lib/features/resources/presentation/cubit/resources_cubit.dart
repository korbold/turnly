// lib/features/resources/presentation/cubit/resources_cubit.dart
import 'dart:developer' as dev;
import 'package:flutter_bloc/flutter_bloc.dart';
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

  Future<bool> deleteResource(String id) async {
    dev.log('[ResourcesCubit] deleteResource id=$id');
    final result = await _repository.delete(id);
    if (result.isRight()) {
      await loadResources();
      return true;
    }
    return false;
  }
}
