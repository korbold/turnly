export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string;
  is_active: boolean;
  image_url: string | null;
  sort_order: number;
  created_at: string;
}
