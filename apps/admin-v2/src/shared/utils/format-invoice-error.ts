/**
 * Turns the raw invoice/billing/SRI error string stored on a service log or
 * reservation into a human-readable Spanish message for the UI.
 *
 * The backend stores whatever the billing service / SRI returned, which is
 * often opaque (e.g. `Billing service error: { "message": "Server Error" }`
 * when the SRI reception environment is down, or a raw SOAP/Hibernate fault).
 * This maps the common cases to something a shop owner can act on, and falls
 * back to a clean generic message instead of dumping JSON/stack text.
 */
export function formatInvoiceError(raw: string | null | undefined): string {
  if (!raw) return 'No se pudo emitir la factura.';

  const s = raw.toLowerCase();

  // SRI reception environment unavailable / internal error. "Server Error",
  // SOAP server faults, and Hibernate "could not execute statement" all mean
  // the SRI web service accepted the request but its backend failed — nothing
  // the user can fix; it resolves on retry once the SRI recovers.
  if (
    s.includes('server error') ||
    s.includes('could not execute statement') ||
    s.includes('soap fault') ||
    s.includes('soap:server') ||
    s.includes('persistenceexception') ||
    s.includes('hibernate') ||
    s.includes('genericjdbc')
  ) {
    return 'El servicio del SRI no está disponible en este momento. Vuelve a intentar en unos minutos.';
  }

  // Network/timeout reaching the SRI or the billing service.
  if (s.includes('timeout') || s.includes('timed out') || s.includes('connection') || s.includes('could not connect')) {
    return 'No se pudo conectar con el SRI. Revisa tu conexión y vuelve a intentar.';
  }

  // SRI 69: consumidor final (07 / 9999999999999) is only valid up to $50.
  // Above that the receptor must be identified, so the fix is to capture the
  // customer's cédula/RUC — not to retry.
  if (s.includes('identificacion del receptor') || s.includes('identificación del receptor')) {
    return 'Sobre $50 el SRI exige la cédula o RUC del cliente: consumidor final no aplica. Agrega el documento en Datos de facturación y reintenta.';
  }

  // SRI 56: the establecimiento used is closed in the taxpayer's RUC. Retrying
  // never helps — the código de establecimiento has to be corrected.
  if (s.includes('establecimiento cerrado')) {
    return 'El establecimiento no está abierto en tu RUC del SRI. Corrige el código de establecimiento en Configuración → Facturación (reintentar no lo soluciona).';
  }

  // Certificate problems (expired / invalid firma electrónica).
  if (s.includes('firma') || s.includes('certificad') || s.includes('pkcs12') || s.includes('p12')) {
    return 'Hay un problema con el certificado de firma electrónica. Revisa los datos de facturación.';
  }

  // A real, structured SRI rejection message (DEVUELTA / validation) — surface
  // it cleanly. Try to pull a "message"/"mensaje" out of a JSON-ish blob,
  // otherwise strip the noisy "Billing service error:" prefix.
  const jsonMatch = raw.match(/"(?:message|mensaje)"\s*:\s*"([^"]+)"/i);
  if (jsonMatch?.[1]) {
    const inner = jsonMatch[1].trim();
    if (inner.toLowerCase() !== 'server error') return `SRI: ${inner}`;
  }

  const cleaned = raw.replace(/^billing service error:\s*/i, '').trim();
  if (cleaned && cleaned !== raw && !cleaned.startsWith('{')) return `SRI: ${cleaned}`;

  return 'El SRI rechazó la factura. Vuelve a intentar o revisa los datos de facturación.';
}
