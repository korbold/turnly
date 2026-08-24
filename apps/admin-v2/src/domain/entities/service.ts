export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  /** Si el trabajo lleva secado. Sólo lo usan las lavadoras: decide si
      completar el registro exige asignar un secador. */
  requiresDryer: boolean;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: Date;
}
