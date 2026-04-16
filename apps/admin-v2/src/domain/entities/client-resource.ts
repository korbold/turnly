export interface ClientResourceClient {
  name: string;
  email: string;
}

export interface ClientResource {
  id: string;
  tenantId: string;
  clientId: string;
  data: Record<string, unknown> | null;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  type: string | null;
  createdAt: Date;
  client?: ClientResourceClient;
}
