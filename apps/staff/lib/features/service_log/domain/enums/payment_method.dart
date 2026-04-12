enum PaymentMethod {
  cash,
  card,
  transfer,
  other;

  static PaymentMethod fromString(String value) {
    switch (value) {
      case 'cash': return PaymentMethod.cash;
      case 'card': return PaymentMethod.card;
      case 'transfer': return PaymentMethod.transfer;
      default: return PaymentMethod.other;
    }
  }

  String get apiValue => name;

  String get label {
    switch (this) {
      case PaymentMethod.cash: return 'Efectivo';
      case PaymentMethod.card: return 'Tarjeta';
      case PaymentMethod.transfer: return 'Transferencia';
      case PaymentMethod.other: return 'Otro';
    }
  }
}
