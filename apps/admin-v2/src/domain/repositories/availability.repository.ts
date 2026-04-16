import type { AvailabilitySlot, AvailabilityBlock } from '../entities/availability';

export interface CreateBlockData {
  date: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

export interface AvailabilityRepository {
  getSlots(): Promise<AvailabilitySlot[]>;
  updateSlots(slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]>;
  getBlocks(): Promise<AvailabilityBlock[]>;
  createBlock(data: CreateBlockData): Promise<AvailabilityBlock>;
  deleteBlock(id: string): Promise<void>;
}
