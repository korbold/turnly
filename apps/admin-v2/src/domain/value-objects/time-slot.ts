export class TimeSlot {
  constructor(readonly start: Date, readonly end: Date) {}

  get durationMinutes(): number {
    return Math.round((this.end.getTime() - this.start.getTime()) / 60000);
  }

  formatRange(): string {
    const fmt = (d: Date) =>
      d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fmt(this.start)} - ${fmt(this.end)}`;
  }
}
