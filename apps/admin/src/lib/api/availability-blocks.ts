import api from './client';
import type { AvailabilityBlock } from '@/types/availability-block';

export async function getAvailabilityBlocks(): Promise<AvailabilityBlock[]> {
  const response = await api.get('/availability-blocks');
  return response.data.data;
}

export async function createAvailabilityBlock(data: {
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
}): Promise<AvailabilityBlock> {
  const response = await api.post('/availability-blocks', data);
  return response.data.data;
}

export async function deleteAvailabilityBlock(id: string): Promise<void> {
  await api.delete(`/availability-blocks/${id}`);
}
