export type VehicleType = 'sedan' | 'suv' | 'pickup' | 'van' | 'motorcycle' | 'other';

export interface Vehicle {
  id: string;
  owner_id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  type: VehicleType;
  created_at: string;
  owner?: { name: string; email: string };
}
