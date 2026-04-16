part of 'clients_bloc.dart';

abstract class ClientsState extends Equatable {
  const ClientsState();

  @override
  List<Object?> get props => [];
}

class ClientsInitial extends ClientsState {
  const ClientsInitial();
}

class ClientsLoading extends ClientsState {
  const ClientsLoading();
}

class ClientsLoaded extends ClientsState {
  final PaginatedResult<ClientResource> result;

  const ClientsLoaded(this.result);

  @override
  List<Object?> get props => [result];
}

class ClientDetailLoaded extends ClientsState {
  final ClientResource client;
  final List<dynamic> history;

  const ClientDetailLoaded({required this.client, required this.history});

  @override
  List<Object?> get props => [client, history];
}

class ClientsError extends ClientsState {
  final String message;

  const ClientsError(this.message);

  @override
  List<Object?> get props => [message];
}
