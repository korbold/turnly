// lib/features/resources/presentation/cubit/resources_cubit.dart
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
    final result = await _repository.create(label: label, data: data);
    if (result.isRight()) {
      await loadResources(); // Reload list
      return true;
    }
    return false;
  }
}
