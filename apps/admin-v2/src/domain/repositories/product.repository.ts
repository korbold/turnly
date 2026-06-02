import type {
  Product,
  ProductType,
  ProductUnit,
  StockMovement,
} from '../entities/product';
import type { PaginatedResult } from '../../shared/types/api';

export interface ListProductsParams {
  page?: number;
  perPage?: number;
  q?: string;
  type?: ProductType;
  lowStock?: boolean;
  active?: boolean;
}

export interface CreateProductInput {
  sku?: string | null;
  name: string;
  description?: string | null;
  type: ProductType;
  unit: ProductUnit;
  cost?: number;
  price?: number;
  taxRate?: number;
  stockMin?: number;
  isActive?: boolean;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export interface RecordMovementInput {
  productId: string;
  type: 'purchase' | 'adjustment' | 'return';
  qty: number;
  unitCost?: number;
  note?: string | null;
}

export interface ProductRepository {
  list(params?: ListProductsParams): Promise<PaginatedResult<Product>>;
  get(id: string): Promise<Product>;
  create(input: CreateProductInput): Promise<Product>;
  update(id: string, input: UpdateProductInput): Promise<Product>;
  delete(id: string): Promise<void>;
  listMovements(productId: string, page?: number): Promise<PaginatedResult<StockMovement>>;
  recordMovement(input: RecordMovementInput): Promise<StockMovement>;
}
