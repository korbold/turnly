import type {
  ReservationRepository,
  CreateReservationData,
  AddItemInput,
  CheckInInput,
} from '@/domain/repositories/reservation.repository';
import type {
  Reservation,
  ReservationFilters,
  ReservationAction,
  AvailableSlot,
  ReservationItem,
  ReservationItemChange,
  BillingSnapshot,
} from '@/domain/entities/reservation';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import {
  mapReservation,
  mapAvailableSlot,
  mapReservationItem,
  mapReservationItemChange,
} from '../mappers/reservation.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

function checkInBody(input: CheckInInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.billingProfileId) body.billing_profile_id = input.billingProfileId;
  if (input.billing) {
    body.billing = {
      doc_type: input.billing.docType,
      doc_number: input.billing.docNumber,
      legal_name: input.billing.legalName,
      email: input.billing.email,
      address: input.billing.address,
      phone: input.billing.phone,
    };
  }
  return body;
}

export class ApiReservationRepository implements ReservationRepository {
  async getAll(filters: ReservationFilters): Promise<PaginatedResult<Reservation>> {
    const params: Record<string, unknown> = {};
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.status) params.status = filters.status;
    if (filters.serviceId) params.service_id = filters.serviceId;
    if (filters.page) params.page = filters.page;

    const { data: res } = await api.get('/reservations', { params });
    return mapPaginatedResponse(res, mapReservation);
  }

  async getById(id: string): Promise<Reservation> {
    const { data: res } = await api.get(`/reservations/${id}`);
    return mapReservation(res.data);
  }

  async create(data: CreateReservationData): Promise<Reservation> {
    const { data: res } = await api.post('/reservations', {
      client_resource_id: data.clientResourceId,
      service_id: data.serviceId,
      service_variant_id: data.serviceVariantId,
      scheduled_at: data.scheduledAt,
      assigned_to: data.assignedTo,
      notes: data.notes,
    });
    return mapReservation(res.data);
  }

  async cancel(id: string, reason: string): Promise<Reservation> {
    const { data: res } = await api.patch(`/reservations/${id}/cancel`, { cancel_reason: reason });
    return mapReservation(res.data);
  }

  async transition(id: string, action: ReservationAction): Promise<Reservation> {
    const { data: res } = await api.patch(`/reservations/${id}/${action}`);
    return mapReservation(res.data);
  }

  async reschedule(id: string, scheduledAt: string): Promise<Reservation> {
    const { data: res } = await api.patch(`/reservations/${id}/reschedule`, {
      scheduled_at: scheduledAt,
    });
    return mapReservation(res.data);
  }

  async getAvailableSlots(date: string, serviceId: string): Promise<AvailableSlot[]> {
    const { data: res } = await api.get('/reservations/available-slots', {
      params: { date, service_id: serviceId },
    });
    return (res.data as Record<string, unknown>[]).map(mapAvailableSlot);
  }

  // Phase 3
  async checkIn(id: string, input: CheckInInput): Promise<Reservation> {
    const { data: res } = await api.post(`/reservations/${id}/check-in`, checkInBody(input));
    return mapReservation(res.data);
  }

  async recordPayment(
    id: string,
    input: {
      method: 'transfer' | 'card' | 'cash';
      reference?: string | null;
      bank?: string | null;
      billing?: CheckInInput['billing'];
      billingProfileId?: string | null;
    },
  ): Promise<Reservation> {
    const { data: res } = await api.post(`/reservations/${id}/payment`, {
      method: input.method,
      reference: input.reference ?? null,
      bank: input.bank ?? null,
      // Fiscal data captured at payment (same shape as check-in).
      ...checkInBody({ billing: input.billing, billingProfileId: input.billingProfileId ?? undefined }),
    });
    return mapReservation(res.data);
  }

  async updateBilling(id: string, input: CheckInInput): Promise<BillingSnapshot | null> {
    const { data: res } = await api.patch(`/reservations/${id}/billing`, checkInBody(input));
    const snap = res.data?.billing_snapshot;
    if (!snap) return null;
    return {
      docType: snap.doc_type,
      docNumber: snap.doc_number,
      legalName: snap.legal_name,
      email: snap.email,
      address: snap.address,
      phone: snap.phone,
      source: snap.source,
      capturedAt: snap.captured_at,
    };
  }

  async listItems(id: string): Promise<ReservationItem[]> {
    const { data: res } = await api.get(`/reservations/${id}/items`);
    return (res.data as Record<string, unknown>[]).map(mapReservationItem);
  }

  async addItem(id: string, input: AddItemInput): Promise<ReservationItem> {
    const { data: res } = await api.post(`/reservations/${id}/items`, {
      item_type: input.itemType,
      ref_id: input.refId,
      qty: input.qty,
      reason: input.reason,
    });
    return mapReservationItem(res.data);
  }

  async removeItem(itemId: string, reason?: string): Promise<void> {
    await api.delete(`/reservation-items/${itemId}`, { data: { reason } });
  }

  async overrideItemPrice(itemId: string, unitPrice: number, reason: string): Promise<ReservationItem> {
    const { data: res } = await api.patch(`/reservation-items/${itemId}/price`, {
      unit_price: unitPrice,
      reason,
    });
    return mapReservationItem(res.data);
  }

  async listChanges(id: string): Promise<ReservationItemChange[]> {
    const { data: res } = await api.get(`/reservations/${id}/changes`);
    return (res.data as Record<string, unknown>[]).map(mapReservationItemChange);
  }

  async emitInvoice(id: string): Promise<void> {
    await api.post(`/reservations/${id}/invoice`);
  }
}
