/** Personal que ejecuta el servicio sin tener cuenta en la app: en una
    lavadora, quién lava y quién seca. `both` hace los dos puestos, que es
    lo normal — el mismo tipo lava un auto y seca el siguiente. */
export type StaffPosition = 'washer' | 'dryer' | 'both';

export interface ServiceStaff {
  id: string;
  name: string;
  position: StaffPosition;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateServiceStaffInput {
  name: string;
  position: StaffPosition;
  isActive?: boolean;
}

export type UpdateServiceStaffInput = Partial<CreateServiceStaffInput>;

export const STAFF_POSITION_LABEL: Record<StaffPosition, string> = {
  washer: 'Lavador',
  dryer: 'Secador',
  both: 'Ambos',
};
