export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}
