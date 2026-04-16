export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: Date;
}
