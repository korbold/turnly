export interface ClientResourceClient {
  name: string;
  email: string;
}

export interface ClientResource {
  id: string;
  tenantId: string;
  clientId: string;
  label: string | null;
  data: Record<string, unknown> | null;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  type: string | null;
  createdAt: Date;
  client?: ClientResourceClient;
  /** Saldo que esta placa debe. Calculado en bloque por el backend. */
  debt: number;
}
