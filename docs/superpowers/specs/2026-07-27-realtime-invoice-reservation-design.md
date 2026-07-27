# Realtime: invoice status + reservation gaps — Design

Date: 2026-07-27
Status: Approved (pending spec review)

## Problem

Users report that reservation status changes and — especially — invoice
(facturación) status changes take time and do **not** update on screen until
they navigate away and back. They asked for "webhooks" on web and mobile; the
real need is **live UI updates**, not outbound HTTP webhooks.

## Existing infrastructure (reused, no new infra)

Realtime already works for the reservation **list** on both clients:

- **Backend**: Laravel Reverb active on dev + prod (`:8080`, exposed as
  `wss://api.goturnly.com/app` via nginx `/app` upgrade proxy).
  `BROADCAST_CONNECTION=reverb` on both servers. Single broadcast event today:
  `App\Events\ReservationUpdated` (`ShouldBroadcast`) → `PrivateChannel("tenant.{tenant_id}")`
  and, when set, `PrivateChannel("customer.{client_id}")`; event name
  `reservation.updated`.
- **Admin (Next.js)**: Laravel Echo + `pusher-js` (`src/lib/echo/client.ts`),
  subscribed to `private-tenant.{tenantId}` in `use-reservations-realtime.ts`,
  mounted app-wide via `RealtimeBridge` in `(tenant)/layout.tsx`. On
  `.reservation.updated` it invalidates the `['reservations']` / `['reservation', id]`
  query keys.
- **Flutter (`customer_v2`)**: `pusher_channels_flutter` (`lib/core/realtime/pusher_service.dart`)
  subscribed to `private-customer.{userId}`, wired in `main.dart` `_RealtimeBridge`;
  on `reservation.updated` it calls `ReservationsCubit.loadReservations()`.
- **Push**: FCM v1 hand-rolled (`FcmService` + `FcmChannel`), device tokens in
  `device_tokens`, gated by plan feature `push_notifications`. Reservation
  lifecycle notifications already exist.

### Gaps this design closes

1. Invoice status flip (`enviada → autorizada | rechazada`) is **not** broadcast
   or pushed — only an email on `autorizada`. Rejection is silent. Admin invoice
   list (now sourced from `/billing/invoices`) is never invalidated live.
2. Flutter reservation **detail** screen does not subscribe to the socket — it
   only refreshes on open / pull-to-refresh.
3. Reservation **created** is not broadcast (only an FCM push to admins), so a
   new booking doesn't appear live in the admin list.

## Decisions

- **Scope**: live UI only. No outbound HTTP webhooks (explicitly out of scope).
- **Invoice push recipients**: admin (tenant staff) on **both** `autorizada` and
  `rechazada`. Client keeps the existing `autorizada` email; no client push.
- **Reservation detail live**: Flutter only. Admin web already invalidates the
  detail query via the existing event.
- **Approach A** (reuse existing events/infra) over folding invoice fields into
  `ReservationUpdated` (couples invoice to reservation, doesn't fit service-log
  invoices) or polling (laggy, wasteful, no Flutter coverage).

## Feature 1 — Invoice status broadcast (admin live)

**Backend**
- New event `App\Events\InvoiceStatusUpdated implements ShouldBroadcast`.
  - `broadcastOn`: `PrivateChannel("tenant.{tenantId}")`.
  - `broadcastAs`: `invoice.status.updated`.
  - `broadcastWith`: `{ referenceType: 'reservation'|'service_log', referenceId,
    invoiceExternalId, status, numeroAutorizacion, claveAcceso }`.
- Dispatch at every point the invoice status is written:
  - `EmitReservationInvoiceJob` / `EmitServiceLogInvoiceJob` — immediate
    `autorizada` path and the initial `enviada` write.
  - `SyncReservationInvoiceStatusJob` / `SyncServiceLogInvoiceStatusJob` — when
    the poll resolves to `autorizada` or `rechazada`.
- Channel authorization already exists (`tenant.{tenantId}` in `routes/channels.php`).

**Admin (Next.js)**
- Extend the realtime layer to also listen on `private-tenant.{tenantId}` for
  `.invoice.status.updated`. On receipt, `invalidateQueries` for `['invoices']`,
  `['service-logs']`, and `['reservations']` (invoice status shows on reservation
  rows too).
- Implementation note: add to the existing `RealtimeBridge` path so a single
  channel subscription carries both event listeners (avoid a second Echo channel).

## Feature 2 — Invoice status push (admin FCM)

**Backend**
- New notifications `InvoiceAuthorized` and `InvoiceRejected` (`ShouldQueue`,
  `via = ['database', FcmChannel::class]`, `toFcm` payload with a deep-link
  `action_type` — reuse `reservation_detail` with the reservation id for
  reservation invoices; for service-log invoices link to the service-log/invoices
  view, `action_type` `invoice_detail` if a distinct target is needed).
- Trigger in the Sync jobs (and the immediate-authorize path in Emit jobs) →
  notify the tenant's admin users. `rechazada` includes the first SRI rejection
  message.
- Respect the existing `push_notifications` plan gate via `FcmChannel`.

## Feature 3 — Flutter reservation detail live

- `PusherService` exposes a broadcast `Stream<ReservationUpdate>` (id + changed
  fields) instead of / in addition to the single `onReservationUpdated` callback.
- `reservation_detail_screen.dart` subscribes in `initState`, filters events by
  the current reservation id, and reloads via `repo.getById` on a match;
  cancels the subscription in `dispose`.
- The existing list refresh (`ReservationsCubit.loadReservations()`) stays.

## Feature 4 — Reservation created broadcast

- In `CreateReservationUseCase`, dispatch the existing `ReservationUpdated`
  after the `NewReservationForAdmin` notification. No client channel dependency
  (tenant channel is what the admin list listens to).
- Admin list already invalidates `['reservations']` on `reservation.updated` →
  new booking appears without refresh.

## Error handling

- Broadcasts are best-effort: a Reverb outage must never fail a job or a use
  case. Dispatch is fire-and-forget (queued listener / event); jobs already have
  `tries`/retry semantics for the billing work itself.
- FCM already auto-deactivates invalid tokens (404/410/UNREGISTERED) — unchanged.
- If a client misses a live event (socket drop), the existing on-mount / focus
  refetch (admin `staleTime` 30s) and pull-to-refresh (Flutter) remain the
  fallback. No guaranteed delivery is promised for the socket layer.

## Testing

- **Backend (Pest)**: assert `InvoiceStatusUpdated` is dispatched with the right
  payload when a Sync job resolves `autorizada` and `rechazada`
  (`Event::fake`); assert `InvoiceAuthorized` / `InvoiceRejected` notifications
  are sent to tenant admins (`Notification::fake`); assert
  `CreateReservationUseCase` dispatches `ReservationUpdated`.
- **Admin**: manual — emit an invoice, confirm the Facturas list and reservation
  row flip to `autorizada` without navigation; confirm a new booking appears
  live.
- **Flutter**: manual — open a reservation detail, change its status from admin,
  confirm the detail updates without pull-to-refresh.

## Out of scope

- Outbound HTTP webhooks to external systems (Zapier/n8n/accounting).
- Customer-facing invoice UI in the Flutter app (customers keep email).
- Client push on invoice authorization (email only).

## Affected files (reference)

Backend: `app/Events/InvoiceStatusUpdated.php` (new), `app/Events/ReservationUpdated.php`,
`app/Application/UseCases/Reservation/CreateReservationUseCase.php`,
`app/Infrastructure/Jobs/{Emit,Sync}{Reservation,ServiceLog}Invoice*Job.php`,
`app/Infrastructure/Notifications/{InvoiceAuthorized,InvoiceRejected}.php` (new).

Admin: `src/presentation/hooks/use-reservations-realtime.ts` (or a new
`use-invoices-realtime.ts` mounted in the same bridge), `RealtimeBridge`.

Flutter: `lib/core/realtime/pusher_service.dart`,
`lib/features/reservations/presentation/screens/reservation_detail_screen.dart`.
