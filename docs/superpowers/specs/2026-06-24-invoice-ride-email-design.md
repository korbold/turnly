# Invoice RIDE PDF + Email Spec

**Date:** 2026-06-24  
**Scope:** Generate SRI-compliant RIDE PDF in the billing service; email it to the client after authorization.

---

## Goal

When a service log or reservation invoice is authorized by the SRI, automatically email the client a PDF of the RIDE (Representación Impresa del Documento Electrónico) as an attachment.

---

## Architecture

Two repos involved:

| Repo | Work |
|---|---|
| `/Facturacion/backend` (billing service) | Add `GET /api/invoices/{id}/ride` — DomPDF + Blade template |
| `apps/backend` (Turnly) | Add `InvoiceMail` mailable; wire into both invoice jobs |

---

## Part 1 — Billing Service: RIDE PDF Endpoint

### New dependencies

- `barryvdh/laravel-dompdf` — PDF generation from Blade
- `picqer/php-barcode-generator` — Code128 barcode for `clave_acceso` (pure PHP, no extensions)

### New route

```
GET /api/invoices/{id}/ride
```

Returns `application/pdf` inline.

### New controller method

`InvoiceController::ride(string $id): Response`

1. Load `InvoiceModel` with `items` + `tenantBillingConfig`
2. Compute tax breakdown from `TaxBreakdown` value object
3. Generate barcode SVG from `clave_acceso` using `picqer/php-barcode-generator` (Code128)
4. Render `ride.invoice` Blade view → DomPDF → return as PDF response

### Blade template layout (`resources/views/ride/invoice.blade.php`)

Matches the SRI standard RIDE design:

**Header (2 columns):**
- Left: emisor razón social, dirección, obligado a llevar contabilidad, régimen
- Right: RUC (bold), "FACTURA" (large), número (red `001-XXX-XXXXXXXXX`), número de autorización, ambiente (`PRUEBAS` / `PRODUCCIÓN`), emisión (`NORMAL`), clave de acceso label + Code128 barcode + digits below

**Buyer section (3 columns):**
- Razón social comprador, email comprador, dirección comprador
- RUC/CI comprador, teléfono comprador, fecha de emisión

**Items table:**
- Columns: Código | Descripción | Cantidad | Precio | Descuento | Total

**Footer (2 columns):**
- Left — Información adicional: email, teléfono, forma de pago (mapped from SRI code), fecha vencimiento
- Right — Totals: Subtotal 0%, Subtotal 15%, Subtotal 5%, Subtotal Sin Impuesto, Descuento, IVA 15%, IVA 5%, **TOTAL**

### Data requirements

`InvoiceModel` must expose (via eager load or casts):
- `clave_acceso`, `numero_autorizacion`, `numero_factura` (formato `001-001-000000001`)
- `estado`, `ambiente` (1=pruebas, 2=producción), `tipo_emision`
- `razon_social_comprador`, `identificacion_comprador`, `direccion_comprador`
- `email_comprador`, `telefono_comprador`, `fecha_emision`
- `forma_pago` (SRI code → human label map)
- `items` (label, qty, unit_price, descuento, line_total)
- `tenantBillingConfig` → emisor razón social, dirección, obligado, régimen, RUC

---

## Part 2 — Turnly Backend: InvoiceMail

### New files

**`app/Infrastructure/Mail/InvoiceMail.php`**

```php
class InvoiceMail extends Mailable implements ShouldQueue
{
    public function __construct(
        public string $clientEmail,
        public string $externalInvoiceId,  // billing service UUID
        public string $invoiceNumber,      // "001-001-000000001"
    ) {}
}
```

- Fetches RIDE PDF via `BillingServiceClient::getInvoiceRide($externalInvoiceId)`
- Attaches as `factura-{invoiceNumber}.pdf` (`application/pdf`)
- Subject: `"Tu factura electrónica {invoiceNumber}"`
- View: `emails.invoice`

**`resources/views/emails/invoice.blade.php`**

Clean HTML matching existing email styles (magic-link pattern). Content:
- Greeting + "Adjuntamos tu factura electrónica autorizada por el SRI."
- Invoice number + date
- "Si tienes dudas, contacta al negocio."

### Wiring in jobs

**`EmitServiceLogInvoiceJob::handle()`** — after DB update, inside the success branch:

```php
if (($result['estado'] ?? '') === 'autorizada') {
    $email = $log->clientResource?->client?->email;
    if ($email && !empty($result['id'])) {
        Mail::to($email)->queue(new InvoiceMail(
            $email,
            $result['id'],
            $log->invoice_numero_autorizacion ?? $result['id'],
        ));
    }
}
```

**`EmitReservationInvoiceJob`** — same block using `$reservation->client?->email`.  
**Fix required:** add `client` to the eager load: `with(['items', 'service', 'variant', 'client'])`.

### Error handling

- If `getInvoiceRide()` throws → let the mailable fail silently (catch + log, do not re-throw — the invoice is already authorized in DB)
- If client has no email → skip silently

---

## Data Flow

```
Job::handle()
  └─ emitInvoice(payload) → {estado: 'autorizada', id: 'uuid', ...}
  └─ reservation/log.update(invoice fields)
  └─ [if autorizada && client email exists]
       └─ Mail::queue(InvoiceMail)
            └─ BillingServiceClient::getInvoiceRide(externalId) → PDF bytes
            └─ attachData(pdfBytes, 'factura-XXX.pdf')
            └─ Resend sends email with attachment
```

---

## Out of Scope

- Retrying failed email sends (Resend handles delivery retries)
- Sending email for `enviada` status (only `autorizada`)
- Reservation client email from `billing_snapshot` (uses `client` relation instead)
- Logo on the RIDE (placeholder box, same as reference design)

---

## Self-Review

- No TBDs or placeholders
- `getInvoiceRide()` already exists in `BillingServiceClient` ✅
- `clientResource.client` already eager-loaded in `EmitServiceLogInvoiceJob` ✅  
- `client` relation missing from `EmitReservationInvoiceJob` — flagged as fix ✅
- Email error must not re-throw (invoice already saved) — explicit ✅
- Barcode library is pure PHP — no server extension required ✅
