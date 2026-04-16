import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/entities/service.dart';
import '../../../shared/types/paginated_result.dart';
import '../../use_cases/services/get_services_use_case.dart';
import '../../use_cases/services/create_service_use_case.dart';
import '../../use_cases/services/update_service_use_case.dart';
import '../../use_cases/services/delete_service_use_case.dart';

part 'services_event.dart';
part 'services_state.dart';

class ServicesBloc extends Bloc<ServicesEvent, ServicesState> {
  final GetServicesUseCase _getServices;
  final CreateServiceUseCase _createService;
  final UpdateServiceUseCase _updateService;
  final DeleteServiceUseCase _deleteService;

  ServicesBloc({
    required GetServicesUseCase getServices,
    required CreateServiceUseCase createService,
    required UpdateServiceUseCase updateService,
    required DeleteServiceUseCase deleteService,
  })  : _getServices = getServices,
        _createService = createService,
        _updateService = updateService,
        _deleteService = deleteService,
        super(const ServicesInitial()) {
    on<LoadServices>(_onLoad);
    on<CreateService>(_onCreate);
    on<UpdateService>(_onUpdate);
    on<DeleteService>(_onDelete);
  }

  Future<void> _onLoad(
      LoadServices event, Emitter<ServicesState> emit) async {
    emit(const ServicesLoading());
    try {
      final result = await _getServices(page: event.page);
      emit(ServicesLoaded(result));
    } catch (e) {
      emit(ServicesError(e.toString()));
    }
  }

  Future<void> _onCreate(
      CreateService event, Emitter<ServicesState> emit) async {
    try {
      await _createService(
        name: event.name,
        price: event.price,
        description: event.description,
        imageUrl: event.imageUrl,
        isActive: event.isActive,
      );
      add(const LoadServices());
    } catch (e) {
      emit(ServicesError(e.toString()));
    }
  }

  Future<void> _onUpdate(
      UpdateService event, Emitter<ServicesState> emit) async {
    try {
      await _updateService(
        event.id,
        name: event.name,
        price: event.price,
        description: event.description,
        imageUrl: event.imageUrl,
        isActive: event.isActive,
        sortOrder: event.sortOrder,
      );
      add(const LoadServices());
    } catch (e) {
      emit(ServicesError(e.toString()));
    }
  }

  Future<void> _onDelete(
      DeleteService event, Emitter<ServicesState> emit) async {
    try {
      await _deleteService(event.id);
      add(const LoadServices());
    } catch (e) {
      emit(ServicesError(e.toString()));
    }
  }
}
