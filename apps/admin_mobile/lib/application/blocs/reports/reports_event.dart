part of 'reports_bloc.dart';

abstract class ReportsEvent extends Equatable {
  const ReportsEvent();

  @override
  List<Object?> get props => [];
}

class LoadRangeReport extends ReportsEvent {
  final String from;
  final String to;

  const LoadRangeReport({required this.from, required this.to});

  @override
  List<Object?> get props => [from, to];
}

class LoadDailyReport extends ReportsEvent {
  final String date;

  const LoadDailyReport(this.date);

  @override
  List<Object?> get props => [date];
}
