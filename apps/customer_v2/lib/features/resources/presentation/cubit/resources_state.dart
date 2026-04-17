// lib/features/resources/presentation/cubit/resources_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/client_resource.dart';

sealed class ResourcesState extends Equatable {
  const ResourcesState();
  @override
  List<Object?> get props => [];
}

class ResourcesInitial extends ResourcesState {
  const ResourcesInitial();
}

class ResourcesLoading extends ResourcesState {
  const ResourcesLoading();
}

class ResourcesLoaded extends ResourcesState {
  final List<ClientResource> resources;
  const ResourcesLoaded(this.resources);
  @override
  List<Object?> get props => [resources];
}

class ResourcesError extends ResourcesState {
  final String message;
  const ResourcesError(this.message);
  @override
  List<Object?> get props => [message];
}
