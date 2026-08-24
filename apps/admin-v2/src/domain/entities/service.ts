export type ServiceStaffing = 'none' | 'washer' | 'washer_dryer';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  /** Qué personal lleva el trabajo. Sólo lo usan las lavadoras: decide qué
      exige completar el registro. Espejo de `App\Domain\ServiceLog\ServiceStaffing`. */
  staffing: ServiceStaffing;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: Date;
}
