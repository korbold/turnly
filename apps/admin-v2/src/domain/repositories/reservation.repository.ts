import type {
  Reservation,
  ReservationFilters,
  ReservationAction,
  AvailableSlot,
  ReservationItem,
  ReservationItemChange,
  BillingSnapshot,
} from '../entities/reservation';
import type { PaginatedResult } from '../../shared/types/api';

export interface CreateReservationData {
  clientResourceId: string;
  serviceId: string;
  serviceVariantId?: string;
  scheduledAt: string;
  assignedTo?: string;
  notes?: string;
}

export interface AddItemInput {
  itemType: 'service_variant' | 'product';
  refId: string;
  qty?: number;
  reason?: string;
}

export interface CheckInInput {
  billingProfileId?: string;
  billing?: Partial<{
    docType: BillingSnapshot['docType'];
    docNumber: string;
    legalName: string;
    email: string;
    address: string;
    phone: string;
  }>;
}

export interface ReservationRepository {
  getAll(filters: ReservationFilters): Promise<PaginatedResult<Reservation>>;
  getById(id: string): Promise<Reservation>;
  create(data: CreateReservationData): Promise<Reservation>;
  cancel(id: string, reason: string): Promise<Reservation>;
  transition(id: string, action: ReservationAction): Promise<Reservation>;
  /** Tenant-staff reschedule. Backend validates pending|confirmed only;
      `scheduledAt` is sent as "YYYY-MM-DD HH:mm:ss" to match the create
      endpoint's contract. */
  reschedule(id: string, scheduledAt: string): Promise<Reservation>;
  getAvailableSlots(date: string, serviceId: string): Promise<AvailableSlot[]>;

  // Phase 3
  checkIn(id: string, input: CheckInInput): Promise<Reservation>;
  updateBilling(id: string, input: CheckInInput): Promise<BillingSnapshot | null>;
  // Phase 4 — pago independent of lifecycle.
  recordPayment(
    id: string,
    input: {
      method: 'transfer' | 'card' | 'cash';
      reference?: string | null;
      bank?: string | null;
      billing?: CheckInInput['billing'];
      billingProfileId?: string | null;
    },
  ): Promise<Reservation>;
  listItems(id: string): Promise<ReservationItem[]>;
  addItem(id: string, input: AddItemInput): Promise<ReservationItem>;
  removeItem(itemId: string, reason?: string): Promise<void>;
  overrideItemPrice(itemId: string, unitPrice: number, reason: string): Promise<ReservationItem>;
  listChanges(id: string): Promise<ReservationItemChange[]>;
  emitInvoice(id: string): Promise<void>;
}
