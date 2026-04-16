export class DateRange {
  constructor(readonly from: Date, readonly to: Date) {}

  toQueryParams(): { date_from: string; date_to: string } {
    return {
      date_from: this.from.toISOString().split('T')[0],
      date_to: this.to.toISOString().split('T')[0],
    };
  }
}
