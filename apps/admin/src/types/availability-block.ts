export interface AvailabilityBlock {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
}
