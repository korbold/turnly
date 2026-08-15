/**
 * Pulls the backend's `error.message` out of a failed request so the UI can
 * show what actually went wrong.
 *
 * Rules the API enforces (a $50 CONSUMIDOR FINAL ceiling, an already
 * authorised factura) come back as a 422 with a message written for the shop
 * owner. Falling back to a generic toast throws that away and leaves them
 * pressing the same button.
 *
 * The axios instance's response interceptor already rejects with a flat
 * `{ message, code, fieldErrors, status }` object, so that shape is checked
 * first; the raw axios error is still handled for any call that bypasses it.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const flat = (error as { message?: unknown })?.message;
  if (typeof flat === 'string' && flat.trim() && !isTransportNoise(flat)) {
    return flat;
  }

  const data = (error as { response?: { data?: unknown } })?.response?.data as
    | { error?: { message?: unknown }; message?: unknown }
    | undefined;

  const message = data?.error?.message ?? data?.message;

  return typeof message === 'string' && message.trim() ? message : fallback;
}

/**
 * axios fills `message` with its own text ("Request failed with status code
 * 422", "Network Error") when the server sent nothing useful — that is noise,
 * not an explanation, so the caller's fallback reads better.
 */
function isTransportNoise(message: string): boolean {
  return /^request failed with status code/i.test(message) || /^network error$/i.test(message);
}
