part of 'service_logs_bloc.dart';

abstract class ServiceLogsEvent extends Equatable {
  const ServiceLogsEvent();

  @override
  List<Object?> get props => [];
}

class LoadServiceLogs extends ServiceLogsEvent {
  final String? date;
  final int? page;

  const LoadServiceLogs({this.date, this.page});

  @override
  List<Object?> get props => [date, page];
}

class CreateServiceLog extends ServiceLogsEvent {
  final int clientResourceId;
  final int serviceId;
  final int attendedBy;
  final double priceCharged;
  final PaymentMethod paymentMethod;
  final String? notes;

  const CreateServiceLog({
    required this.clientResourceId,
    required this.serviceId,
    required this.attendedBy,
    required this.priceCharged,
    required this.paymentMethod,
    this.notes,
  });

  @override
  List<Object?> get props => [
        clientResourceId,
        serviceId,
        attendedBy,
        priceCharged,
        paymentMethod,
        notes,
      ];
}

class CompleteServiceLog extends ServiceLogsEvent {
  final int id;

  const CompleteServiceLog(this.id);

  @override
  List<Object?> get props => [id];
}

class LoadSummary extends ServiceLogsEvent {
  final String date;

  const LoadSummary(this.date);

  @override
  List<Object?> get props => [date];
}
