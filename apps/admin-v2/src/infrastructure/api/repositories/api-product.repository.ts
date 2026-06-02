import type {
  CreateProductInput,
  ListProductsParams,
  ProductRepository,
  RecordMovementInput,
  UpdateProductInput,
} from '@/domain/repositories/product.repository';
import type { Product, StockMovement } from '@/domain/entities/product';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapProduct, mapStockMovement } from '../mappers/product.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

function buildBody(input: CreateProductInput | UpdateProductInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if ('sku' in input) body.sku = input.sku ?? null;
  if (input.name !== undefined) body.name = input.name;
  if ('description' in input) body.description = input.description ?? null;
  if (input.type !== undefined) body.type = input.type;
  if (input.unit !== undefined) body.unit = input.unit;
  if (input.cost !== undefined) body.cost = input.cost;
  if (input.price !== undefined) body.price = input.price;
  if (input.taxRate !== undefined) body.tax_rate = input.taxRate;
  if (input.stockMin !== undefined) body.stock_min = input.stockMin;
  if (input.isActive !== undefined) body.is_active = input.isActive;
  return body;
}

export class ApiProductRepository implements ProductRepository {
  async list(params?: ListProductsParams): Promise<PaginatedResult<Product>> {
    const q: Record<string, unknown> = {};
    if (params?.page) q.page = params.page;
    if (params?.perPage) q.per_page = params.perPage;
    if (params?.q) q.q = params.q;
    if (params?.type) q.type = params.type;
    if (params?.lowStock) q.low_stock = 1;
    if (params?.active !== undefined) q.active = params.active ? 1 : 0;

    const { data: res } = await api.get('/products', { params: q });
    return mapPaginatedResponse(res, mapProduct);
  }

  async get(id: string): Promise<Product> {
    const { data: res } = await api.get(`/products/${id}`);
    return mapProduct(res.data);
  }

  async create(input: CreateProductInput): Promise<Product> {
    const { data: res } = await api.post('/products', buildBody(input));
    return mapProduct(res.data);
  }

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const { data: res } = await api.patch(`/products/${id}`, buildBody(input));
    return mapProduct(res.data);
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  }

  async listMovements(productId: string, page?: number): Promise<PaginatedResult<StockMovement>> {
    const { data: res } = await api.get(`/products/${productId}/movements`, {
      params: { page },
    });
    return mapPaginatedResponse(res, mapStockMovement);
  }

  async recordMovement(input: RecordMovementInput): Promise<StockMovement> {
    const { data: res } = await api.post('/stock-movements', {
      product_id: input.productId,
      type: input.type,
      qty: input.qty,
      unit_cost: input.unitCost,
      note: input.note,
    });
    return mapStockMovement(res.data);
  }
}
