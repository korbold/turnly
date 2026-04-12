import 'package:intl/intl.dart';

extension DateTimeExtensions on DateTime {
  String toDisplayDate() => DateFormat('d MMM yyyy', 'es').format(this);
  String toDisplayTime() => DateFormat('HH:mm').format(this);
  String toDisplayDateTime() => DateFormat('d MMM yyyy HH:mm', 'es').format(this);
  String toApiFormat() => toIso8601String();
  String toApiDate() => DateFormat('yyyy-MM-dd').format(this);
}

extension StringDateExtensions on String {
  DateTime toDateTime() => DateTime.parse(this);
}
