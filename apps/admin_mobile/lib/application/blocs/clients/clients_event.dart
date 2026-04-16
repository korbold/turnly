part of 'clients_bloc.dart';

abstract class ClientsEvent extends Equatable {
  const ClientsEvent();

  @override
  List<Object?> get props => [];
}

class LoadClients extends ClientsEvent {
  final int? page;
  final String? search;

  const LoadClients({this.page, this.search});

  @override
  List<Object?> get props => [page, search];
}

class LoadClient extends ClientsEvent {
  final int id;

  const LoadClient(this.id);

  @override
  List<Object?> get props => [id];
}
