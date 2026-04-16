export class Money {
  constructor(readonly amount: number, readonly currency: string = 'COP') {}

  format(): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 0,
    }).format(this.amount);
  }

  formatShort(): string {
    if (this.amount >= 1_000_000) return `$${(this.amount / 1_000_000).toFixed(1)}M`;
    if (this.amount >= 1_000) return `$${(this.amount / 1_000).toFixed(0)}k`;
    return `$${this.amount}`;
  }
}
