import 'package:flutter/material.dart';
import '../../domain/enums/payment_method.dart';

class PaymentBadge extends StatelessWidget {
  final PaymentMethod method;
  const PaymentBadge({super.key, required this.method});

  Color get _color {
    switch (method) {
      case PaymentMethod.cash: return Colors.green;
      case PaymentMethod.card: return Colors.blue;
      case PaymentMethod.transfer: return Colors.orange;
      case PaymentMethod.other: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _color.withValues(alpha: 0.3)),
      ),
      child: Text(
        method.label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _color),
      ),
    );
  }
}
