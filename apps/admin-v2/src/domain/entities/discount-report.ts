/** Un precio que se apartó del catálogo, de cualquiera de los dos orígenes. */
export interface DiscountItem {
  source: 'service_log' | 'reservation';
  id: string;
  date: Date;
  userName: string | null;
  clientLabel: string | null;
  serviceLabel: string | null;
  catalog: number;
  charged: number;
  /** Negativa cuando se cobró de menos. Es el signo que importa. */
  difference: number;
  reasonCode: string | null;
  reasonLabel: string | null;
  note: string | null;
}

export interface DiscountGroup {
  code: string | null;
  label: string;
  name: string;
  total: number;
  count: number;
}

export interface DiscountReport {
  /** Sólo lo regalado. Un recargo no lo compensa. */
  totalGivenAway: number;
  byReason: DiscountGroup[];
  byUser: DiscountGroup[];
  items: DiscountItem[];
}
