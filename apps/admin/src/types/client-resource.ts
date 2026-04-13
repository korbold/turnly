export interface ClientResource {
  id: string;
  tenant_id: string;
  client_id: string;
  data: Record<string, unknown> | null;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  type: string | null;
  created_at: string;
  client?: { name: string; email: string };
}
