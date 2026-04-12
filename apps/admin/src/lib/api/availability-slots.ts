import api from './client';

export interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_concurrent: number;
  is_active: boolean;
}

export async function getAvailabilitySlots(): Promise<AvailabilitySlot[]> {
  const response = await api.get('/availability-slots');
  return response.data.data;
}

export async function updateAvailabilitySlots(slots: {
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  max_concurrent?: number;
}[]): Promise<AvailabilitySlot[]> {
  const response = await api.put('/availability-slots', { slots });
  return response.data.data;
}
