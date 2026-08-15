/**
 * Pulls the backend's `error.message` out of a failed request so the UI can
 * show what actually went wrong.
 *
 * Rules the API enforces (a $50 CONSUMIDOR FINAL ceiling, an already
 * authorised factura) come back as a 422 with a message written for the shop
 * owner. Falling back to a generic toast throws that away and leaves them
 * pressing the same button.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data as
    | { error?: { message?: unknown }; message?: unknown }
    | undefined;

  const message = data?.error?.message ?? data?.message;

  return typeof message === 'string' && message.trim() ? message : fallback;
}
