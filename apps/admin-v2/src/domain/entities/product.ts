export type ProductType = 'consumable' | 'sellable' | 'both';
export type ProductUnit = 'ml' | 'L' | 'g' | 'kg' | 'u';

export type StockMovementType =
  | 'purchase'
  | 'sale'
  | 'consumption'
  | 'adjustment'
  | 'return';

export interface ProductStock {
  onHand: number;
  reserved: number;
  avgCost: number;
  low: boolean;
}

export interface Product {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  type: ProductType;
  unit: ProductUnit;
  cost: number;
  price: number;
  taxRate: number;
  stockMin: number;
  isActive: boolean;
  stock: ProductStock | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  qty: number;
  unitCost: number;
  refType: string | null;
  refId: string | null;
  user: { id: string; name: string } | null;
  note: string | null;
  createdAt: Date;
}
