import api from '@/infrastructure/api/client';
import type {
  Debt, DebtItem, DebtItemType, AddManualDebtInput, PayDebtInput,
} from '@/domain/entities/debt';
import type { DebtRepository } from '@/domain/repositories/debt.repository';

type Raw = Record<string, unknown>;

function mapItem(raw: Raw): DebtItem {
  return {
    type: raw.type as DebtItemType,
    id: raw.id as string,
    label: raw.label as string,
    date: raw.date as string,
    amount: Number(raw.amount ?? 0),
    paid: Number(raw.paid ?? 0),
    due: Number(raw.due ?? 0),
  };
}

export class ApiDebtRepository implements DebtRepository {
  async get(clientResourceId: string): Promise<Debt> {
    const { data: res } = await api.get<{ data: Raw }>(
      `/client-resources/${clientResourceId}/debt`,
    );
    const d = res.data;
    return {
      clientResourceId: d.client_resource_id as string,
      total: Number(d.total ?? 0),
      items: ((d.items as Raw[]) ?? []).map(mapItem),
      payments: ((d.payments as Raw[]) ?? []).map((p) => ({
        id: p.id as string,
        amount: Number(p.amount ?? 0),
        method: p.method as string,
        paidAt: new Date(p.paid_at as string),
      })),
    };
  }

  async addManual(input: AddManualDebtInput): Promise<void> {
    await api.post('/debts/manual', {
      client_resource_id: input.clientResourceId,
      amount: input.amount,
      reason: input.reason,
      incurred_on: input.incurredOn,
    });
  }

  async pay(input: PayDebtInput): Promise<void> {
    await api.post('/debts/payments', {
      client_resource_id: input.clientResourceId,
      amount: input.amount,
      method: input.method,
      bank: input.bank ?? null,
      ...(input.allocations ? { allocations: input.allocations } : {}),
    });
  }
}
