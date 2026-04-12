import {
  Car, Scissors, Stethoscope, Sparkles, Dumbbell, Building2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface BusinessType {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const BUSINESS_TYPES: BusinessType[] = [
  { value: 'car_wash', label: 'Lavado de autos', description: 'Car wash y detailing', icon: Car },
  { value: 'barbershop', label: 'Barbería', description: 'Cortes y arreglo de barba', icon: Scissors },
  { value: 'medical', label: 'Consultorio médico', description: 'Consultas y controles', icon: Stethoscope },
  { value: 'spa', label: 'Spa & Belleza', description: 'Masajes y tratamientos', icon: Sparkles },
  { value: 'gym', label: 'Gimnasio', description: 'Clases y entrenamiento', icon: Dumbbell },
  { value: 'other', label: 'Otro', description: 'Cualquier negocio con citas', icon: Building2 },
];

export const BRAND_THEMES = [
  { value: 'blue', label: 'Azul', primary: '#3B82F6', secondary: '#1E40AF' },
  { value: 'green', label: 'Verde', primary: '#22C55E', secondary: '#15803D' },
  { value: 'red', label: 'Rojo', primary: '#EF4444', secondary: '#B91C1C' },
  { value: 'purple', label: 'Púrpura', primary: '#A855F7', secondary: '#7E22CE' },
  { value: 'orange', label: 'Naranja', primary: '#F97316', secondary: '#C2410C' },
  { value: 'teal', label: 'Teal', primary: '#14B8A6', secondary: '#0F766E' },
  { value: 'pink', label: 'Rosa', primary: '#EC4899', secondary: '#BE185D' },
  { value: 'gray', label: 'Gris', primary: '#6B7280', secondary: '#374151' },
];
