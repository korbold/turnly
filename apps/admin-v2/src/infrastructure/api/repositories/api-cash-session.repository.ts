import api from '@/infrastructure/api/client';
import type {
  CashActor,
  CashMovement,
  CashMovementType,
  CashSession,
  CashSessionSnapshot,
  CashSessionStatus,
  OpenCashSessionInput,
  AddCashMovementInput,
  CloseCashSessionInput,
  ReopenCashSessionInput,
  CashByPerson,
  CashSessionDetail,
  CashClosure,
} from '@/domain/entities/cash-session';
import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';

type Raw = Record<string, unknown>;

function mapActor(raw: unknown): CashActor | null {
  if (!raw) return null;
  const a = raw as Raw;
  return { id: a.id as string, name: a.name as string };
}

function mapMovement(raw: Raw): CashMovement {
  return {
    id: raw.id as string,
    type: raw.type as CashMovementType,
    amount: Number(raw.amount ?? 0),
    reason: raw.reason as string,
    createdAt: new Date(raw.created_at as string),
    createdBy: mapActor(raw.created_by),
  };
}

function mapSession(raw: Raw): CashSession {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: raw.id as string,
    businessDate: raw.business_date as string,
    status: raw.status as CashSessionStatus,
    openingAmount: Number(raw.opening_amount ?? 0),
    openedAt: new Date(raw.opened_at as string),
    openedBy: mapActor(raw.opened_by),
    closedAt: raw.closed_at ? new Date(raw.closed_at as string) : null,
    closedBy: mapActor(raw.closed_by),
    countedAmount: num(raw.counted_amount),
    expectedAmount: num(raw.expected_amount),
    difference: num(raw.difference),
    notes: (raw.notes as string) ?? null,
    movements: ((raw.movements as Raw[]) ?? []).map(mapMovement),
    cashByPerson: raw.cash_by_person
      ? (raw.cash_by_person as Raw[]).map(
          (p): CashByPerson => ({
            userId: (p.user_id as string) ?? null,
            name: p.name as string,
            count: Number(p.count ?? 0),
            amount: Number(p.amount ?? 0),
          }),
        )
      : null,
  };
}

function mapClosure(raw: Raw): CashClosure {
  return {
    id: raw.id as string,
    countedAmount: Number(raw.counted_amount ?? 0),
    countedBreakdown: (raw.counted_breakdown as CashClosure['countedBreakdown']) ?? null,
    expectedAmount: Number(raw.expected_amount ?? 0),
    difference: Number(raw.difference ?? 0),
    closedAt: new Date(raw.closed_at as string),
    closedBy: mapActor(raw.closed_by),
    notes: (raw.notes as string) ?? null,
    reopenedAt: raw.reopened_at ? new Date(raw.reopened_at as string) : null,
    reopenedBy: mapActor(raw.reopened_by),
    reopenReason: (raw.reopen_reason as string) ?? null,
  };
}

export class ApiCashSessionRepository implements CashSessionRepository {
  async list(): Promise<CashSession[]> {
    const { data: res } = await api.get<{ data: Raw[] }>('/cash-sessions');
    return (res.data ?? []).map(mapSession);
  }

  async detail(id: string): Promise<CashSessionDetail> {
    const { data: res } = await api.get<{ data: Raw }>(`/cash-sessions/${id}`);
    return {
      ...mapSession(res.data),
      closures: ((res.data.closures as Raw[]) ?? []).map(mapClosure),
    };
  }

  async get(date: string): Promise<CashSessionSnapshot> {
    const { data: res } = await api.get<{ data: Raw | null; meta?: Raw }>('/cash-session', {
      params: { date },
    });
    return {
      session: res.data ? mapSession(res.data) : null,
      cashWithoutSession: Number(res.meta?.cash_without_session ?? 0),
      pendingCollection: {
        count: Number((res.meta?.pending_collection as Raw)?.count ?? 0),
        amount: Number((res.meta?.pending_collection as Raw)?.amount ?? 0),
      },
    };
  }

  async open(input: OpenCashSessionInput): Promise<CashSession> {
    const { data: res } = await api.post<{ data: Raw }>('/cash-sessions', {
      opening_amount: input.openingAmount,
      ...(input.businessDate ? { business_date: input.businessDate } : {}),
    });
    return mapSession(res.data);
  }

  async addMovement(input: AddCashMovementInput): Promise<CashMovement> {
    const { data: res } = await api.post<{ data: Raw }>(
      `/cash-sessions/${input.sessionId}/movements`,
      { type: input.type, amount: input.amount, reason: input.reason },
    );
    return mapMovement(res.data);
  }

  async close(input: CloseCashSessionInput): Promise<CashSession> {
    const { data: res } = await api.post<{ data: Raw }>(
      `/cash-sessions/${input.sessionId}/close`,
      {
        // El total no viaja: lo calcula el backend desde el conteo. Mandarlo
        // sería volver a tener un número que nadie contó.
        breakdown: {
          bills: input.breakdown.bills,
          coins: input.breakdown.coins,
          ...(input.breakdown.otherAmount
            ? {
                other_amount: input.breakdown.otherAmount,
                other_note: input.breakdown.otherNote ?? '',
              }
            : {}),
        },
        ...(input.notes ? { notes: input.notes } : {}),
      },
    );
    return mapSession(res.data);
  }

  async reopen(input: ReopenCashSessionInput): Promise<CashSession> {
    const { data: res } = await api.post<{ data: Raw }>(
      `/cash-sessions/${input.sessionId}/reopen`,
      { reason: input.reason },
    );
    return mapSession(res.data);
  }
}
