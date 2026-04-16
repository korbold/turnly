import type { AvailabilityRepository, CreateBlockData } from '@/domain/repositories/availability.repository';
import type { AvailabilitySlot, AvailabilityBlock } from '@/domain/entities/availability';
import api from '../client';

function mapSlot(raw: Record<string, unknown>): AvailabilitySlot {
  return {
    id: raw.id as string,
    dayOfWeek: raw.day_of_week as number,
    startTime: raw.start_time as string,
    endTime: raw.end_time as string,
    maxConcurrent: raw.max_concurrent as number,
    isActive: raw.is_active as boolean,
  };
}

function mapBlock(raw: Record<string, unknown>): AvailabilityBlock {
  return {
    id: raw.id as string,
    date: raw.date as string,
    startTime: (raw.start_time as string) ?? null,
    endTime: (raw.end_time as string) ?? null,
    reason: (raw.reason as string) ?? null,
    createdAt: new Date(raw.created_at as string),
  };
}

export class ApiAvailabilityRepository implements AvailabilityRepository {
  async getSlots(): Promise<AvailabilitySlot[]> {
    const { data } = await api.get('/availability-slots');
    const slots = data.data ?? data;
    return (slots as Record<string, unknown>[]).map(mapSlot);
  }

  async updateSlots(slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]> {
    const body = slots.map((s) => ({
      id: s.id,
      day_of_week: s.dayOfWeek,
      start_time: s.startTime,
      end_time: s.endTime,
      max_concurrent: s.maxConcurrent,
      is_active: s.isActive,
    }));
    const { data } = await api.put('/availability-slots', { slots: body });
    const result = data.data ?? data;
    return (result as Record<string, unknown>[]).map(mapSlot);
  }

  async getBlocks(): Promise<AvailabilityBlock[]> {
    const { data } = await api.get('/availability-blocks');
    const blocks = data.data ?? data;
    return (blocks as Record<string, unknown>[]).map(mapBlock);
  }

  async createBlock(blockData: CreateBlockData): Promise<AvailabilityBlock> {
    const { data } = await api.post('/availability-blocks', {
      date: blockData.date,
      start_time: blockData.startTime,
      end_time: blockData.endTime,
      reason: blockData.reason,
    });
    return mapBlock(data.data ?? data);
  }

  async deleteBlock(id: string): Promise<void> {
    await api.delete(`/availability-blocks/${id}`);
  }
}
