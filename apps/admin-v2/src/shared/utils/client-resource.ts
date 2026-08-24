import type { ClientResource } from '@/domain/entities/client-resource';

/**
 * Leer un recurso de cliente sin creerle a las columnas.
 *
 * Dos cosas de producción obligan a esto:
 *
 * 1. Las columnas denormalizadas (`plate`, `brand`, `model`, `color`) están
 *    vacías: `EloquentClientResourceRepository::save()` persiste sólo
 *    `tenant_id`, `client_id` y `data`. En prod son NULL en las 268 filas.
 * 2. El usuario ligado no siempre es el cliente. En un walk-in el mostrador
 *    crea el recurso colgado de la CAJERA, así que `client.name` devuelve
 *    "Vanessa" para el auto de Gaby. El nombre escrito en `data` es el que
 *    corresponde a ESE vehículo.
 *
 * Las claves de `data` son campos personalizados por tenant, así que se
 * buscan por patrón: uno guarda "plate" y otro podría guardar "placa".
 */
export function pickField(
  data: Record<string, unknown> | null | undefined,
  key: RegExp,
): string | null {
  if (!data) return null;
  for (const k of Object.keys(data)) {
    if (key.test(k)) {
      const v = data[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return null;
}

/** La columna si tiene algo, `data` si no. */
export function columnOrData(
  value: string | null | undefined,
  data: Record<string, unknown> | null | undefined,
  key: RegExp,
): string | null {
  if (value && value.trim()) return value.trim();
  return pickField(data, key);
}

export const plateOf = (r: ClientResource) =>
  columnOrData(r.plate, r.data, /^(plate|placa)$/i);

/** El nombre tecleado gana sobre el del usuario ligado. Ver el bloque de arriba. */
export const clientNameOf = (r: ClientResource) =>
  pickField(r.data, /^(nombre|name)$/i) ?? r.client?.name ?? null;

export const vehicleInfoOf = (r: ClientResource) =>
  [
    columnOrData(r.brand, r.data, /^(brand|marca)$/i),
    columnOrData(r.model, r.data, /^(model|modelo)$/i),
    columnOrData(r.color, r.data, /^color$/i),
  ].filter(Boolean) as string[];

export const phoneOf = (r: ClientResource) =>
  pickField(r.data, /(tel|phone|cel|whats)/i);

/** Los correos sintéticos del walk-in no son un dato para mostrar. */
export const isSyntheticEmail = (email: string | undefined | null): boolean =>
  !!email && /@client\.local$/i.test(email);

/**
 * El correo del usuario ligado, sólo si ese usuario ES el cliente.
 *
 * Cuando el recurso quedó colgado de la cajera, su mail real aparecía en la
 * ficha como si fuera el del cliente: la pantalla del auto de Gaby mostraba
 * `cajero@autospa.ec`. Si `data` trae un nombre distinto al del usuario
 * ligado, ese usuario es personal del local y su contacto no se muestra.
 */
export const contactEmailOf = (r: ClientResource): string | null => {
  const email = r.client?.email;
  if (!email || isSyntheticEmail(email)) return null;

  const tecleado = pickField(r.data, /^(nombre|name)$/i);
  const ligado = r.client?.name ?? null;
  const esOtraPersona = !!tecleado && !!ligado && tecleado.toLowerCase() !== ligado.toLowerCase();

  return esOtraPersona ? null : email;
};
