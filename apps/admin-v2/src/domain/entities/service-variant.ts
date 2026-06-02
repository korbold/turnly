export interface BomLine {
  id?: string;
  productId: string;
  qty: number;
  product?: {
    id: string;
    name: string;
    unit: string;
    sku: string | null;
  } | null;
}

export interface ServiceVariant {
  id: string;
  serviceId: string;
  label: string;
  price: number;
  durationMin: number;
  sortOrder: number;
  isActive: boolean;
  consumption?: BomLine[];
  createdAt?: Date;
  updatedAt?: Date;
}
