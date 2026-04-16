import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/entities/client_resource.dart';
import '../../../shared/types/paginated_result.dart';
import '../../use_cases/clients/get_clients_use_case.dart';
import '../../use_cases/clients/get_client_use_case.dart';
import '../../use_cases/clients/get_client_history_use_case.dart';

part 'clients_event.dart';
part 'clients_state.dart';

class ClientsBloc extends Bloc<ClientsEvent, ClientsState> {
  final GetClientsUseCase _getClients;
  final GetClientUseCase _getClient;
  final GetClientHistoryUseCase _getClientHistory;

  ClientsBloc({
    required GetClientsUseCase getClients,
    required GetClientUseCase getClient,
    required GetClientHistoryUseCase getClientHistory,
  })  : _getClients = getClients,
        _getClient = getClient,
        _getClientHistory = getClientHistory,
        super(const ClientsInitial()) {
    on<LoadClients>(_onLoadClients);
    on<LoadClient>(_onLoadClient);
  }

  Future<void> _onLoadClients(
      LoadClients event, Emitter<ClientsState> emit) async {
    emit(const ClientsLoading());
    try {
      final result = await _getClients(page: event.page, search: event.search);
      emit(ClientsLoaded(result));
    } catch (e) {
      emit(ClientsError(e.toString()));
    }
  }

  Future<void> _onLoadClient(
      LoadClient event, Emitter<ClientsState> emit) async {
    emit(const ClientsLoading());
    try {
      final results = await Future.wait([
        _getClient(event.id),
        _getClientHistory(event.id),
      ]);
      emit(ClientDetailLoaded(
        client: results[0] as ClientResource,
        history: results[1] as List<dynamic>,
      ));
    } catch (e) {
      emit(ClientsError(e.toString()));
    }
  }
}
