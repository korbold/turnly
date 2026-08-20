import type {
  ServiceLogRepository,
  AssignStaffData,
  CreateServiceLogData,
  UpdateServiceLogData,
  UpdateServiceLogItemsData,
  RecordPaymentData,
  ServiceLogBillingProfile,
} from '@/domain/repositories/service-log.repository';
import type { ServiceLog, ServiceLogFilters, DailySummary } from '@/domain/entities/service-log';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapServiceLog, mapDailySummary } from '../mappers/service-log.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

export class ApiServiceLogRepository implements ServiceLogRepository {
  async getAll(filters: ServiceLogFilters): Promise<PaginatedResult<ServiceLog>> {
    const params: Record<string, unknown> = {};
    if (filters.date) params.date = filters.date;
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.paymentBank) params.payment_bank = filters.paymentBank;
    if (filters.page) params.page = filters.page;
    if (filters.perPage) params.per_page = filters.perPage;
    if (filters.payment) params.payment = filters.payment;
    if (filters.status) params.status = filters.status;
    if (filters.q?.trim()) params.q = filters.q.trim();

    const { data: res } = await api.get('/service-logs', { params });
    return mapPaginatedResponse(res, mapServiceLog);
  }

  async getById(id: string): Promise<ServiceLog> {
    const { data: res } = await api.get(`/service-logs/${id}`);
    return mapServiceLog(res.data);
  }

  async create(data: CreateServiceLogData): Promise<ServiceLog> {
    const body: Record<string, unknown> = {
      client_resource_id: data.clientResourceId,
      attended_by: data.attendedBy,
      washed_by: data.washedBy ?? null,
      dried_by: data.driedBy ?? null,
      payment_method: data.paymentMethod,
      payment_bank: data.paymentBank ?? null,
      payment_status: data.paymentStatus ?? 'paid',
      notes: data.notes,
    };
    // Sólo si tiene valor: mandar null o 0 haría que el backend registre un
    // cobro de cero en vez de cobrar el total.
    if (data.amountReceived) {
      body.amount_received = data.amountReceived;
    }
    if (data.priceChangeReason) {
      body.price_change_reason = data.priceChangeReason;
      if (data.priceChangeNote) {
        body.price_change_note = data.priceChangeNote;
      }
    }
    if (data.items && data.items.length > 0) {
      body.items = data.items.map((it) => ({
        item_type: it.itemType ?? 'service_variant',
        service_id: it.serviceId ?? null,
        product_id: it.productId ?? null,
        variant_id: it.variantId ?? null,
        label: it.label,
        qty: it.qty,
        unit_price: it.unitPrice,
      }));
      // Backend derives service_id + price_charged from the first
      // service line + the sum; we still echo them so older request
      // paths can read. A product-only ticket has no service at all.
      body.service_id =
        data.items.find((it) => (it.itemType ?? 'service_variant') !== 'product')?.serviceId ?? null;
      body.price_charged = data.items.reduce(
        (acc, it) => acc + it.unitPrice * it.qty,
        0,
      );
    } else {
      body.service_id = data.serviceId;
      body.price_charged = data.priceCharged;
    }
    const { data: res } = await api.post('/service-logs', body);
    return mapServiceLog(res.data);
  }

  async recordPayment(id: string, data: RecordPaymentData): Promise<ServiceLog> {
    const { data: res } = await api.post(`/service-logs/${id}/payment`, {
      method: data.method,
      bank: data.bank ?? null,
      reference: data.reference ?? null,
      // Sin monto el backend cobra el saldo entero, que es lo que hacía antes.
      ...(data.amount ? { amount: data.amount } : {}),
    });
    return mapServiceLog(res.data);
  }

  async update(id: string, data: UpdateServiceLogData): Promise<ServiceLog> {
    const body: Record<string, unknown> = {};
    if (data.serviceId !== undefined) body.service_id = data.serviceId;
    if (data.attendedBy !== undefined) body.attended_by = data.attendedBy;
    if (data.priceCharged !== undefined) body.price_charged = data.priceCharged;
    if (data.paymentMethod !== undefined) body.payment_method = data.paymentMethod;
    if (data.paymentBank !== undefined) body.payment_bank = data.paymentBank;
    if (data.notes !== undefined) body.notes = data.notes;

    const { data: res } = await api.patch(`/service-logs/${id}`, body);
    return mapServiceLog(res.data);
  }

  async assignStaff(id: string, data: AssignStaffData): Promise<ServiceLog> {
    // Sólo se mandan las claves presentes: omitir es distinto de null.
    const payload: Record<string, unknown> = {};
    if (data.washedBy !== undefined) payload.washed_by = data.washedBy;
    if (data.driedBy !== undefined) payload.dried_by = data.driedBy;

    const { data: res } = await api.patch<{ data: Record<string, unknown> }>(
      `/service-logs/${id}/assignees`,
      payload,
    );
    return mapServiceLog(res.data);
  }

  async updateItems(id: string, items: UpdateServiceLogItemsData): Promise<ServiceLog> {
    const { data: res } = await api.put(`/service-logs/${id}/items`, {
      items: items.map((it) => ({
        service_id:  it.serviceId,
        variant_id:  it.variantId ?? null,
        label:       it.label,
        qty:         it.qty,
        unit_price:  it.unitPrice,
      })),
    });
    return mapServiceLog(res.data);
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/service-logs/${id}`);
  }

  async complete(id: string, leftOwing?: boolean): Promise<ServiceLog> {
    const { data: res } = await api.patch(
      `/service-logs/${id}/complete`,
      leftOwing ? { left_owing: true } : {},
    );
    return mapServiceLog(res.data);
  }

  async getSummary(date: string): Promise<DailySummary> {
    const { data: res } = await api.get('/service-logs/summary', { params: { date } });
    return mapDailySummary(res.data);
  }

  async getBilling(id: string): Promise<ServiceLogBillingProfile> {
    const { data: res } = await api.get(`/service-logs/${id}/billing`);
    return mapBilling(res.data);
  }

  async updateBilling(id: string, data: ServiceLogBillingProfile): Promise<ServiceLogBillingProfile> {
    const { data: res } = await api.put(`/service-logs/${id}/billing`, {
      doc_type:   data.docType,
      doc_number: data.docNumber,
      legal_name: data.legalName,
      email:      data.email,
      address:    data.address,
      phone:      data.phone,
    });
    return mapBilling(res.data);
  }
}

function mapBilling(raw: Record<string, unknown>): ServiceLogBillingProfile {
  return {
    docType:   (raw.doc_type as ServiceLogBillingProfile['docType']) ?? 'final_consumer',
    docNumber: (raw.doc_number as string) ?? '',
    legalName: (raw.legal_name as string) ?? '',
    email:     (raw.email as string) ?? '',
    address:   (raw.address as string) ?? '',
    phone:     (raw.phone as string) ?? '',
  };
}
