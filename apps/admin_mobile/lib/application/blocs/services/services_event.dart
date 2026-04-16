part of 'services_bloc.dart';

abstract class ServicesEvent extends Equatable {
  const ServicesEvent();

  @override
  List<Object?> get props => [];
}

class LoadServices extends ServicesEvent {
  final int? page;

  const LoadServices({this.page});

  @override
  List<Object?> get props => [page];
}

class CreateService extends ServicesEvent {
  final String name;
  final double price;
  final String? description;
  final String? imageUrl;
  final bool? isActive;

  const CreateService({
    required this.name,
    required this.price,
    this.description,
    this.imageUrl,
    this.isActive,
  });

  @override
  List<Object?> get props => [name, price, description, imageUrl, isActive];
}

class UpdateService extends ServicesEvent {
  final int id;
  final String? name;
  final double? price;
  final String? description;
  final String? imageUrl;
  final bool? isActive;
  final int? sortOrder;

  const UpdateService({
    required this.id,
    this.name,
    this.price,
    this.description,
    this.imageUrl,
    this.isActive,
    this.sortOrder,
  });

  @override
  List<Object?> get props =>
      [id, name, price, description, imageUrl, isActive, sortOrder];
}

class DeleteService extends ServicesEvent {
  final int id;

  const DeleteService(this.id);

  @override
  List<Object?> get props => [id];
}
