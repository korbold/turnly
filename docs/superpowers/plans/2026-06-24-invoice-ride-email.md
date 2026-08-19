# Invoice RIDE PDF + Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a SRI-compliant RIDE PDF in the billing service and email it to the client after invoice authorization.

**Architecture:** Billing service adds `GET /api/invoices/{id}/ride` (DomPDF + Blade). Turnly backend adds `InvoiceMail` (ShouldQueue) that fetches the PDF from billing and attaches it; both invoice jobs enqueue the mail after `estado === 'autorizada'`.

**Tech Stack:** DomPDF (`barryvdh/laravel-dompdf`), `picqer/php-barcode-generator`, Laravel Mailable, Resend (MAIL_MAILER).

## Global Constraints

- Billing service: `/Users/korbold/Developer/Freelancer/Facturacion/backend` (standalone Laravel)
- Turnly backend: `apps/backend/` in monorepo
- RIDE barcode: Code128 from `clave_acceso` (49-char SRI key)
- Email only when `estado === 'autorizada'`; skip silently if no email
- Mail errors must NOT rethrow — invoice already saved, email is best-effort
- Blade views: no JS, inline CSS only (DomPDF + email clients)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `/Facturacion/backend/composer.json` | Modify | Add dompdf + barcode deps |
| `/Facturacion/backend/app/Infrastructure/Persistence/Models/InvoiceModel.php` | Modify | Add `emissionPoint.establishment.config` eager chain; expose `numero_factura` accessor |
| `/Facturacion/backend/app/Infrastructure/Http/Controllers/InvoiceController.php` | Modify | Add `ride(string $id): Response` |
| `/Facturacion/backend/resources/views/ride/invoice.blade.php` | Create | SRI RIDE PDF layout |
| `/Facturacion/backend/routes/api.php` | Modify | Add `GET /{id}/ride` route |
| `apps/backend/app/Infrastructure/Mail/InvoiceMail.php` | Create | Mailable: fetch RIDE PDF, attach, send |
| `apps/backend/resources/views/emails/invoice.blade.php` | Create | Email HTML body |
| `apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php` | Modify | Queue `InvoiceMail` when `autorizada` |
| `apps/backend/app/Infrastructure/Jobs/EmitReservationInvoiceJob.php` | Modify | Add `client` to eager load; queue `InvoiceMail` when `autorizada` |

---

## Task 1: Billing Service — RIDE PDF Endpoint

**Files:**
- Modify: `/Facturacion/backend/composer.json`
- Modify: `/Facturacion/backend/app/Infrastructure/Persistence/Models/InvoiceModel.php`
- Modify: `/Facturacion/backend/app/Infrastructure/Http/Controllers/InvoiceController.php`
- Create: `/Facturacion/backend/resources/views/ride/invoice.blade.php`
- Modify: `/Facturacion/backend/routes/api.php`

**Interfaces:**
- Produces: `GET /api/invoices/{id}/ride` → `application/pdf` response
- Consumed by: `BillingServiceClient::getInvoiceRide()` in Turnly (already implemented)

- [ ] **Step 1: Install packages**

```bash
cd /Users/korbold/Developer/Freelancer/Facturacion/backend
composer require barryvdh/laravel-dompdf picqer/php-barcode-generator
```

Expected: packages added to `composer.json` and `vendor/`.

- [ ] **Step 2: Add `tenantBillingConfig` accessor + `numero_factura` accessor to `InvoiceModel`**

File: `/Facturacion/backend/app/Infrastructure/Persistence/Models/InvoiceModel.php`

Add these imports at the top (after existing ones):
```php
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
```

Add these methods to the class (after existing `emissionPoint()` relation):
```php
public function tenantBillingConfig(): HasOneThrough
{
    // InvoiceModel → EmissionPointModel → BillingEstablishmentModel → TenantBillingConfigModel
    // Simpler: go via tenant_id directly
    return $this->hasOneThrough(
        TenantBillingConfigModel::class,
        EmissionPointModel::class,
        'id',           // emission_points.id
        'id',           // tenant_billing_configs.id — won't work directly
        'emission_point_id',
        'establishment_id',
    );
}

public function getNumeroFacturaAttribute(): string
{
    $estab  = $this->emissionPoint?->establishment?->estab ?? '001';
    $ptoEmi = $this->emissionPoint?->pto_emi ?? '001';
    $seq    = str_pad($this->secuencial, 9, '0', STR_PAD_LEFT);
    return "{$estab}-{$ptoEmi}-{$seq}";
}
```

> Note: `hasOneThrough` won't easily traverse the 3-hop chain to `TenantBillingConfigModel`. Instead use a direct scope: load config via `tenant_id` in the controller. The `getNumeroFacturaAttribute` only needs the emission point chain.

Actually, replace the `tenantBillingConfig()` with a simpler direct relation:

```php
public function emissionPoint(): BelongsTo
{
    return $this->belongsTo(EmissionPointModel::class, 'emission_point_id');
}

public function getNumeroFacturaAttribute(): string
{
    $estab  = $this->emissionPoint?->establishment?->estab ?? '001';
    $ptoEmi = $this->emissionPoint?->pto_emi ?? '001';
    $seq    = str_pad($this->secuencial, 9, '0', STR_PAD_LEFT);
    return "{$estab}-{$ptoEmi}-{$seq}";
}
```

Add `numero_factura` to `$appends`:
```php
protected $appends = ['numero_factura'];
```

Full updated `InvoiceModel.php`:
```php
<?php

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InvoiceModel extends Model
{
    use HasUuids;

    protected $table = 'invoices';

    protected $appends = ['numero_factura'];

    protected $fillable = [
        'emission_point_id', 'tenant_id', 'external_ref_id',
        'clave_acceso', 'secuencial', 'estado',
        'numero_autorizacion', 'fecha_autorizacion', 'fecha_emision',
        'tipo_identificacion_comprador', 'razon_social_comprador',
        'identificacion_comprador', 'direccion_comprador',
        'total_sin_impuestos', 'total_descuento', 'total_iva', 'importe_total',
        'forma_pago', 'xml_firmado', 'sri_response', 'intentos_envio',
    ];

    protected function casts(): array
    {
        return [
            'fecha_autorizacion' => 'datetime',
            'fecha_emision' => 'date',
            'total_sin_impuestos' => 'decimal:2',
            'total_descuento' => 'decimal:2',
            'total_iva' => 'decimal:2',
            'importe_total' => 'decimal:2',
            'sri_response' => 'array',
            'intentos_envio' => 'integer',
        ];
    }

    public function emissionPoint(): BelongsTo
    {
        return $this->belongsTo(EmissionPointModel::class, 'emission_point_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItemModel::class, 'invoice_id')->orderBy('sort_order');
    }

    public function getNumeroFacturaAttribute(): string
    {
        $estab  = $this->emissionPoint?->establishment?->estab ?? '001';
        $ptoEmi = $this->emissionPoint?->pto_emi ?? '001';
        $seq    = str_pad((string) $this->secuencial, 9, '0', STR_PAD_LEFT);
        return "{$estab}-{$ptoEmi}-{$seq}";
    }
}
```

- [ ] **Step 3: Add `ride()` to `InvoiceController`**

File: `/Facturacion/backend/app/Infrastructure/Http/Controllers/InvoiceController.php`

Add these imports at the top:
```php
use App\Infrastructure\Persistence\Models\TenantBillingConfigModel;
use Barryvdh\DomPDF\Facade\Pdf;
use Picqer\Barcode\BarcodeGeneratorSVG;
```

Add this method to `InvoiceController` (after the `xml()` method):
```php
public function ride(string $id): Response
{
    $invoice = InvoiceModel::with([
        'items',
        'emissionPoint.establishment',
    ])->findOrFail($id);

    $config = TenantBillingConfigModel::where('tenant_id', $invoice->tenant_id)->firstOrFail();

    $generator = new BarcodeGeneratorSVG();
    $barcodeSvg = $generator->getBarcode(
        $invoice->clave_acceso ?? '',
        BarcodeGeneratorSVG::TYPE_CODE_128,
        1.2,
        50,
    );

    $formasPago = [
        '01' => 'Sin utilización del Sistema Financiero (Efectivo)',
        '16' => 'Tarjeta de débito / crédito',
        '20' => 'Otros con utilización del Sistema Financiero',
    ];

    $pdf = Pdf::loadView('ride.invoice', [
        'invoice'     => $invoice,
        'config'      => $config,
        'barcodeSvg'  => $barcodeSvg,
        'formaPago'   => $formasPago[$invoice->forma_pago] ?? $invoice->forma_pago,
        'ambiente'    => $config->ambiente === 2 ? 'PRODUCCIÓN' : 'PRUEBAS',
    ])->setPaper('A4', 'portrait');

    return response($pdf->output(), 200, [
        'Content-Type'        => 'application/pdf',
        'Content-Disposition' => 'inline; filename="' . $invoice->clave_acceso . '.pdf"',
    ]);
}
```

- [ ] **Step 4: Add route**

File: `/Facturacion/backend/routes/api.php`

Change:
```php
Route::prefix('invoices')->group(function () {
    Route::get('/', [InvoiceController::class, 'index']);
    Route::post('/', [InvoiceController::class, 'store']);
    Route::get('/{id}', [InvoiceController::class, 'show']);
    Route::get('/{id}/xml', [InvoiceController::class, 'xml']);
});
```

To:
```php
Route::prefix('invoices')->group(function () {
    Route::get('/', [InvoiceController::class, 'index']);
    Route::post('/', [InvoiceController::class, 'store']);
    Route::get('/{id}', [InvoiceController::class, 'show']);
    Route::get('/{id}/xml', [InvoiceController::class, 'xml']);
    Route::get('/{id}/ride', [InvoiceController::class, 'ride']);
});
```

- [ ] **Step 5: Create Blade RIDE template**

Create file: `/Facturacion/backend/resources/views/ride/invoice.blade.php`

```blade
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 8pt; color: #1a1a1a; }
  .page { padding: 12mm 10mm; }

  /* Header */
  .header { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
  .header td { vertical-align: top; padding: 3mm; }
  .header .left { width: 55%; border: 1px solid #999; }
  .header .right { width: 45%; border: 1px solid #999; text-align: center; }
  .logo-box { width: 30mm; height: 20mm; border: 1px dashed #bbb; display: inline-block;
              text-align: center; line-height: 20mm; color: #aaa; font-size: 7pt; }
  .razon-social { font-size: 9pt; font-weight: bold; margin-top: 2mm; }
  .ruc-label { font-size: 10pt; font-weight: bold; margin-bottom: 2mm; }
  .doc-type { font-size: 13pt; font-weight: bold; margin-bottom: 2mm; }
  .doc-number { font-size: 9pt; color: #cc0000; font-weight: bold; margin-bottom: 2mm; }
  .auth-label { font-size: 7pt; color: #555; margin-bottom: 1mm; }
  .auth-number { font-size: 7pt; font-weight: bold; word-break: break-all; margin-bottom: 2mm; }
  .badge { display: inline-block; border: 1px solid #333; padding: 1mm 2mm;
           font-size: 7pt; margin-bottom: 1mm; }
  .barcode-section { margin-top: 2mm; }
  .barcode-digits { font-size: 6pt; word-break: break-all; margin-top: 1mm; color: #333; }

  /* Buyer */
  .buyer { width: 100%; border-collapse: collapse; border: 1px solid #999; margin-bottom: 3mm; }
  .buyer td { padding: 2mm 3mm; border: 1px solid #ddd; font-size: 7.5pt; vertical-align: top; }
  .buyer .label { font-weight: bold; color: #555; font-size: 7pt; }
  .buyer .value { font-size: 8pt; }

  /* Items table */
  .items { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
  .items th { background: #444; color: #fff; padding: 2mm 3mm; font-size: 7.5pt;
              text-align: left; border: 1px solid #333; }
  .items th.right { text-align: right; }
  .items td { padding: 2mm 3mm; border: 1px solid #ccc; font-size: 7.5pt; vertical-align: top; }
  .items td.right { text-align: right; }
  .items tr:nth-child(even) td { background: #f7f7f7; }

  /* Footer */
  .footer { width: 100%; border-collapse: collapse; }
  .footer td { vertical-align: top; }
  .footer .left { width: 55%; padding-right: 4mm; }
  .footer .right { width: 45%; }
  .info-box { border: 1px solid #999; padding: 3mm; }
  .info-row { margin-bottom: 1.5mm; }
  .info-row .lbl { font-weight: bold; font-size: 7pt; color: #555; }
  .info-row .val { font-size: 7.5pt; }
  .totals { width: 100%; border-collapse: collapse; border: 1px solid #999; }
  .totals td { padding: 1.5mm 3mm; border-bottom: 1px solid #eee; font-size: 7.5pt; }
  .totals td.amount { text-align: right; font-weight: bold; }
  .totals tr.total-row td { background: #444; color: #fff; font-size: 9pt; font-weight: bold; }
  .totals tr.total-row td.amount { color: #fff; }
</style>
</head>
<body>
<div class="page">

  {{-- HEADER --}}
  <table class="header">
    <tr>
      <td class="left">
        <div class="logo-box">LOGO</div>
        <div class="razon-social">{{ $config->razon_social }}</div>
        @if($config->nombre_comercial)
          <div style="font-size:8pt; color:#555; margin-top:1mm;">{{ $config->nombre_comercial }}</div>
        @endif
        <div style="margin-top:2mm; font-size:7.5pt;">
          <strong>Dir:</strong> {{ $config->dir_matriz }}
        </div>
        <div style="margin-top:1mm; font-size:7.5pt;">
          <strong>Oblig. contabilidad:</strong> {{ $config->obligado_contabilidad ? 'SI' : 'NO' }}
        </div>
        @if($config->is_rimpe)
          <div style="margin-top:1mm; font-size:7.5pt;"><strong>Régimen:</strong> RIMPE</div>
        @endif
      </td>
      <td class="right">
        <div class="ruc-label">R.U.C.: {{ $config->ruc }}</div>
        <div class="doc-type">FACTURA</div>
        <div class="doc-number">No. {{ $invoice->numero_factura }}</div>
        <div class="auth-label">NÚMERO DE AUTORIZACIÓN</div>
        <div class="auth-number">{{ $invoice->numero_autorizacion ?? $invoice->clave_acceso }}</div>
        <div>
          <span class="badge">{{ $ambiente }}</span>
          <span class="badge" style="margin-left:2mm;">EMISIÓN NORMAL</span>
        </div>
        <div class="barcode-section">
          <div class="auth-label" style="margin-bottom:1mm;">CLAVE DE ACCESO</div>
          {!! $barcodeSvg !!}
          <div class="barcode-digits">{{ $invoice->clave_acceso }}</div>
        </div>
      </td>
    </tr>
  </table>

  {{-- BUYER --}}
  <table class="buyer">
    <tr>
      <td colspan="3" style="background:#eee; font-weight:bold; font-size:7.5pt; padding:1.5mm 3mm;">
        DATOS DEL ADQUIRIENTE / COMPRADOR
      </td>
    </tr>
    <tr>
      <td style="width:40%;">
        <div class="label">Razón Social / Nombre Completo:</div>
        <div class="value">{{ $invoice->razon_social_comprador }}</div>
      </td>
      <td style="width:30%;">
        <div class="label">Fecha de Emisión:</div>
        <div class="value">{{ $invoice->fecha_emision?->format('d/m/Y') }}</div>
      </td>
      <td style="width:30%;">
        <div class="label">Identificación:</div>
        <div class="value">{{ $invoice->identificacion_comprador }}</div>
      </td>
    </tr>
    <tr>
      <td colspan="2">
        <div class="label">Dirección:</div>
        <div class="value">{{ $invoice->direccion_comprador ?? '-' }}</div>
      </td>
      <td>
        <div class="label">Forma de Pago:</div>
        <div class="value">{{ $formaPago }}</div>
      </td>
    </tr>
  </table>

  {{-- ITEMS TABLE --}}
  <table class="items">
    <thead>
      <tr>
        <th style="width:12%;">Código</th>
        <th style="width:38%;">Descripción</th>
        <th class="right" style="width:10%;">Cantidad</th>
        <th class="right" style="width:13%;">Precio Unit.</th>
        <th class="right" style="width:12%;">Descuento</th>
        <th class="right" style="width:15%;">Total</th>
      </tr>
    </thead>
    <tbody>
      @foreach($invoice->items as $item)
      <tr>
        <td>{{ $item->codigo_principal ?? '-' }}</td>
        <td>{{ $item->descripcion }}</td>
        <td class="right">{{ number_format((float)$item->cantidad, 2) }}</td>
        <td class="right">${{ number_format((float)$item->precio_unitario, 2) }}</td>
        <td class="right">${{ number_format((float)$item->descuento, 2) }}</td>
        <td class="right">${{ number_format((float)$item->precio_total_sin_impuesto, 2) }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>

  {{-- FOOTER --}}
  <table class="footer">
    <tr>
      <td class="left">
        <div class="info-box">
          <div style="font-weight:bold; font-size:7.5pt; margin-bottom:2mm; border-bottom:1px solid #ccc; padding-bottom:1mm;">
            INFORMACIÓN ADICIONAL
          </div>
          <div class="info-row">
            <span class="lbl">Forma de pago:</span>
            <span class="val"> {{ $formaPago }}</span>
          </div>
          <div class="info-row">
            <span class="lbl">Ambiente:</span>
            <span class="val"> {{ $ambiente }}</span>
          </div>
          @if($invoice->fecha_autorizacion)
          <div class="info-row">
            <span class="lbl">Fecha autorización:</span>
            <span class="val"> {{ $invoice->fecha_autorizacion->format('d/m/Y H:i') }}</span>
          </div>
          @endif
        </div>
      </td>
      <td class="right">
        <table class="totals">
          @php
            $subtotal0   = 0;
            $subtotal15  = 0;
            $subtotal5   = 0;
            $totalDesc   = (float)$invoice->total_descuento;
            foreach ($invoice->items as $it) {
                $pct = (int)($it->codigo_porcentaje_iva ?? 0);
                if ($pct === 4) $subtotal15 += (float)$it->precio_total_sin_impuesto;
                elseif ($pct === 5) $subtotal5 += (float)$it->precio_total_sin_impuesto;
                else $subtotal0 += (float)$it->precio_total_sin_impuesto;
            }
          @endphp
          @if($subtotal0 > 0)
          <tr><td>Subtotal 0%</td><td class="amount">${{ number_format($subtotal0, 2) }}</td></tr>
          @endif
          @if($subtotal15 > 0)
          <tr><td>Subtotal 15%</td><td class="amount">${{ number_format($subtotal15, 2) }}</td></tr>
          @endif
          @if($subtotal5 > 0)
          <tr><td>Subtotal 5%</td><td class="amount">${{ number_format($subtotal5, 2) }}</td></tr>
          @endif
          <tr><td>Subtotal Sin Impuestos</td><td class="amount">${{ number_format((float)$invoice->total_sin_impuestos, 2) }}</td></tr>
          <tr><td>Descuento</td><td class="amount">${{ number_format($totalDesc, 2) }}</td></tr>
          <tr><td>IVA 15%</td><td class="amount">${{ number_format((float)$invoice->total_iva, 2) }}</td></tr>
          <tr class="total-row"><td>VALOR TOTAL</td><td class="amount">${{ number_format((float)$invoice->importe_total, 2) }}</td></tr>
        </table>
      </td>
    </tr>
  </table>

</div>
</body>
</html>
```

- [ ] **Step 6: Smoke-test locally**

```bash
cd /Users/korbold/Developer/Freelancer/Facturacion/backend
php artisan serve --port=8001
# In another terminal:
curl -o /tmp/test-ride.pdf http://localhost:8001/api/invoices/{REAL_INVOICE_UUID}/ride
open /tmp/test-ride.pdf
```

Expected: PDF opens; shows emisor data, buyer, items table, barcode.

- [ ] **Step 7: Commit billing service**

```bash
cd /Users/korbold/Developer/Freelancer/Facturacion/backend
git add composer.json composer.lock \
  app/Infrastructure/Persistence/Models/InvoiceModel.php \
  app/Infrastructure/Http/Controllers/InvoiceController.php \
  resources/views/ride/invoice.blade.php \
  routes/api.php
git commit -m "feat(billing): add RIDE PDF endpoint with SRI layout and barcode"
```

---

## Task 2: Turnly Backend — InvoiceMail + Wire Into Jobs

**Files:**
- Create: `apps/backend/app/Infrastructure/Mail/InvoiceMail.php`
- Create: `apps/backend/resources/views/emails/invoice.blade.php`
- Modify: `apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php`
- Modify: `apps/backend/app/Infrastructure/Jobs/EmitReservationInvoiceJob.php`

**Interfaces:**
- Consumes: `BillingServiceClient::getInvoiceRide(string $id): string` (already exists)
- Consumes: `$log->clientResource?->client?->email` (EmitServiceLogInvoiceJob)
- Consumes: `$reservation->client?->email` (EmitReservationInvoiceJob — `client` relation via `client_id` on `ReservationModel`)

- [ ] **Step 1: Create `InvoiceMail`**

Create file: `apps/backend/app/Infrastructure/Mail/InvoiceMail.php`

```php
<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

use App\Infrastructure\Billing\BillingServiceClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class InvoiceMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $clientEmail,
        public readonly string $externalInvoiceId,
        public readonly string $invoiceNumber,
        public readonly string $issuedAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Tu factura electrónica {$this->invoiceNumber}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.invoice',
            with: [
                'invoiceNumber' => $this->invoiceNumber,
                'issuedAt'      => $this->issuedAt,
            ],
        );
    }

    public function attachments(): array
    {
        try {
            $pdfBytes = app(BillingServiceClient::class)->getInvoiceRide($this->externalInvoiceId);
            $filename = 'factura-' . str_replace('/', '-', $this->invoiceNumber) . '.pdf';

            return [
                Attachment::fromData(fn () => $pdfBytes, $filename)
                    ->withMime('application/pdf'),
            ];
        } catch (Throwable $e) {
            Log::warning('InvoiceMail: failed to fetch RIDE PDF', [
                'invoice_id' => $this->externalInvoiceId,
                'error'      => $e->getMessage(),
            ]);
            return [];
        }
    }
}
```

- [ ] **Step 2: Create email Blade view**

Create file: `apps/backend/resources/views/emails/invoice.blade.php`

```blade
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Tu factura electrónica</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#FAFAFB; margin:0; padding:24px; color:#2E3441;">
  <table align="center" width="100%" style="max-width:520px;" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding:0 0 20px;">
        <table cellspacing="0" cellpadding="0" border="0" style="width:auto;">
          <tr>
            <td style="background:#F2693A; width:36px; height:36px; border-radius:8px; vertical-align:middle; text-align:center; font-weight:800; color:#FFFFFF; font-size:16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">T</td>
            <td style="padding-left:10px; vertical-align:middle; font-size:18px; font-weight:700; color:#0E121A; letter-spacing:-0.01em;">Turnly</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#FFFFFF; border:1px solid #E4E7EC; border-radius:16px; padding:32px;">
        <h1 style="font-size:22px; font-weight:700; color:#0E121A; margin:0 0 12px; letter-spacing:-0.01em;">
          Tu factura electrónica
        </h1>
        <p style="color:#4B5462; line-height:1.55; font-size:15px; margin:0 0 16px;">
          Adjuntamos tu factura electrónica autorizada por el SRI.
        </p>
        <table style="width:100%; background:#F4F5F7; border-radius:10px; padding:16px; margin-bottom:20px;" cellspacing="0" cellpadding="0">
          <tr>
            <td style="font-size:13px; color:#6B7280; padding-bottom:6px;">Número de factura</td>
            <td style="font-size:13px; color:#0E121A; font-weight:600; text-align:right;">{{ $invoiceNumber }}</td>
          </tr>
          <tr>
            <td style="font-size:13px; color:#6B7280;">Fecha de emisión</td>
            <td style="font-size:13px; color:#0E121A; font-weight:600; text-align:right;">{{ $issuedAt }}</td>
          </tr>
        </table>
        <p style="color:#8B92A0; font-size:13px; line-height:1.5; margin:0;">
          Si tienes dudas sobre esta factura, contacta al negocio que te prestó el servicio.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 0 0; text-align:center; color:#8B92A0; font-size:12px;">
        Turnly · goturnly.com
      </td>
    </tr>
  </table>
</body>
</html>
```

- [ ] **Step 3: Wire `InvoiceMail` into `EmitServiceLogInvoiceJob`**

File: `apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php`

Add these imports (after existing `use` block):
```php
use App\Infrastructure\Mail\InvoiceMail;
use Illuminate\Support\Facades\Mail;
```

In `handle()`, after the `$log->update([...])` block (inside the `try`, after line 63):
```php
        try {
            $result = $client->emitInvoice($payload);

            $log->update([
                'invoice_external_id'         => $result['id'] ?? null,
                'invoice_status'              => $result['estado'] ?? 'enviada',
                'invoice_clave_acceso'        => $result['clave_acceso'] ?? null,
                'invoice_numero_autorizacion' => $result['numero_autorizacion'] ?? null,
                'invoice_error'               => null,
                'invoiced'                    => true,
                'invoiced_at'                 => now(),
            ]);

            if (($result['estado'] ?? '') === 'autorizada') {
                $email = $log->clientResource?->client?->email;
                if ($email && !empty($result['id'])) {
                    Mail::to($email)->queue(new InvoiceMail(
                        clientEmail:       $email,
                        externalInvoiceId: $result['id'],
                        invoiceNumber:     $result['numero_autorizacion'] ?? $result['id'],
                        issuedAt:          now()->format('d/m/Y'),
                    ));
                }
            }
        } catch (Throwable $e) {
```

- [ ] **Step 4: Wire `InvoiceMail` into `EmitReservationInvoiceJob`**

File: `apps/backend/app/Infrastructure/Jobs/EmitReservationInvoiceJob.php`

Add these imports:
```php
use App\Infrastructure\Mail\InvoiceMail;
use Illuminate\Support\Facades\Mail;
```

Change eager load from:
```php
$reservation = ReservationModel::with(['items', 'service', 'variant'])->findOrFail($this->reservationId);
```
To:
```php
$reservation = ReservationModel::with(['items', 'service', 'variant', 'client'])->findOrFail($this->reservationId);
```

In `handle()`, after `$reservation->update([...])` (inside the `try`):
```php
            if (($result['estado'] ?? '') === 'autorizada') {
                $email = $reservation->client?->email;
                if ($email && !empty($result['id'])) {
                    Mail::to($email)->queue(new InvoiceMail(
                        clientEmail:       $email,
                        externalInvoiceId: $result['id'],
                        invoiceNumber:     $result['numero_autorizacion'] ?? $result['id'],
                        issuedAt:          now()->format('d/m/Y'),
                    ));
                }
            }
```

- [ ] **Step 5: Run backend tests**

```bash
cd apps/backend
composer test
```

Expected: same 164 pass + 6 pre-existing failures. No new failures.

> The `InvoiceMail::attachments()` calls `BillingServiceClient::getInvoiceRide()`. In tests the queue is `sync`, but `InvoiceMail` is queued via `Mail::to()->queue()`. With `Queue::fake()` in the existing reservation test, `InvoiceMail` will NOT be dispatched synchronously — it will be queued as a job and skipped. No HTTP call to billing service occurs. ✅

> If any test dispatches a mail synchronously without queue fake, add `Mail::fake()` to that test.

- [ ] **Step 6: Commit Turnly changes**

```bash
cd /Users/korbold/Developer/Freelancer/Turnly
git add \
  apps/backend/app/Infrastructure/Mail/InvoiceMail.php \
  apps/backend/resources/views/emails/invoice.blade.php \
  apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php \
  apps/backend/app/Infrastructure/Jobs/EmitReservationInvoiceJob.php
git commit -m "feat(billing): email RIDE PDF to client after invoice authorization"
```

---

## Self-Review

**Spec coverage:**
- ✅ RIDE PDF endpoint in billing service
- ✅ Barcode SVG (Code128 from clave_acceso)
- ✅ SRI layout (header: emisor+RUC/FACTURA, buyer, items, footer totals)
- ✅ `InvoiceMail` ShouldQueue
- ✅ Fetch PDF via `BillingServiceClient::getInvoiceRide()` and attach
- ✅ Wire into both jobs, only when `autorizada`
- ✅ Skip silently if no email or PDF fetch fails (catch + log, no rethrow)
- ✅ `client` added to reservation eager load

**Placeholder scan:** None. All code blocks complete.

**Type consistency:**
- `InvoiceMail` constructor uses named args in both job call sites ✅
- `getInvoiceRide()` returns `string` (raw bytes) — used as `fromData(fn() => $pdfBytes)` ✅
- `numero_factura` accessor on `InvoiceModel` returns `string` ✅

**Edge cases handled:**
- No client email → `if ($email && ...)` skip ✅
- PDF fetch throws → catch in `attachments()`, log, return `[]` (send email without attachment) ✅
- Invoice not `autorizada` → `if (estado === 'autorizada')` guard ✅
- `clave_acceso` null in barcode → `?? ''` fallback ✅
