/**
 * Enlaces de WhatsApp que de verdad abren.
 *
 * `wa.me` exige el número internacional sin `+` ni ceros a la izquierda, y los
 * negocios guardan el suyo como lo dicen en voz alta: "0991213606". El enlace
 * de la página pública se armaba quitando los no-dígitos y quedaba
 * `wa.me/0991213606`, que no resuelve a ningún contacto. Estuvo así desde que
 * existe esa página.
 */

/** Prefijos por país, de los países donde hoy hay negocios. */
const DIAL_CODES: Record<string, string> = {
  EC: '593',
  CO: '57',
  PE: '51',
  MX: '52',
  AR: '54',
  CL: '56',
};

/**
 * Devuelve el número en formato internacional, o `null` si no hay con qué.
 *
 * Reglas, en orden: un `+` o un prefijo ya presente se respetan; un número
 * local que empieza en 0 pierde el cero y toma el prefijo del país del
 * negocio. Lo que no encaje se devuelve en dígitos, sin inventar prefijo: es
 * mejor un enlace que el dueño ve fallar que uno que manda a un desconocido.
 */
export function toInternational(raw: string | null | undefined, country?: string | null): string | null {
  if (!raw) return null;

  const hadPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return null;

  const dial = DIAL_CODES[(country ?? 'EC').toUpperCase()] ?? DIAL_CODES.EC;

  if (hadPlus) return digits;
  if (digits.startsWith(dial) && digits.length > dial.length + 6) return digits;
  if (digits.startsWith('0')) return dial + digits.slice(1);

  return digits;
}

/** El enlace listo para un `href`, con el mensaje ya escrito. */
export function whatsappLink(
  raw: string | null | undefined,
  message?: string,
  country?: string | null,
): string | null {
  const number = toInternational(raw, country);
  if (!number) return null;

  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${number}${text}`;
}
