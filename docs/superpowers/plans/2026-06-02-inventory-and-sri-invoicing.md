# Inventory + SRI Electronic Invoicing

**Status**: planning
**Owner**: Danny
**Started**: 2026-06-02

## Context

Vertical-scale expansion driven by feedback from a car-wash owner (compadre, 2026-06-01 meeting). Two features requested:

1. **Inventory control** — track consumables (shampoo, wax, oil) and resaleable products (air fresheners, microfibers). Auto-deduct on service completion.
2. **SRI Electronic Invoicing** — emit `factura`, `nota_credito`, `retencion`, `guia_remision` per Ecuador's tax authority (Servicio de Rentas Internas).

In-house only — no third-party providers (no Datafast, Contífico, FactuPro). Owner wants $0 recurring cost per tenant.

## Goals

- Inventory model that handles **consumables + sellables** unified.
- Service catalog with **variants** (Pequeño / Mediano / Grande) to avoid duplicate services per car size.
- **Bill of materials (BOM)** per service variant so completing a service auto-deducts the right consumables.
- Reservation state machine extended with `checked_in` so cashier can adjust items before commitment.
- Full SRI invoicing pipeline: cert P12 upload, XML build, XAdES-BES sign, WS Recepción + Autorización, RIDE PDF, email to customer, 7-year archive.
- Billing profile per user (collected in customer app once, reusable). Snapshot per reservation to prevent drift.

## Non-Goals

- Third-party invoicing providers.
- Multi-warehouse / multi-establecimiento per tenant in MVP (just one matriz).
- POS hardware integration (cash drawer, barcode scanner) in MVP.
- Bank reconciliation, accounting ledger beyond what SRI requires.

## Architecture

### Inventory Domain

#### `products`
```sql
products
  id UUID, tenant_id, sku, name,
  type ENUM('consumable','sellable','both'),
  unit ENUM('ml','L','g','kg','u'),
  cost DECIMAL(12,4), price DECIMAL(12,2),
  tax_rate DECIMAL(5,2),   -- IVA 0/12/15
  stock_min DECIMAL(12,3),
  is_active BOOLEAN,
  timestamps
```

#### `product_stock_levels` (cache)
```sql
product_stock_levels
  product_id PK, on_hand DECIMAL(12,3), reserved DECIMAL(12,3), updated_at
```
Derived from `stock_movements` ledger. Never updated directly by app code — recomputed by a job after each movement insert.

#### `stock_movements` (ledger, immutable)
```sql
stock_movements
  id, tenant_id, product_id,
  type ENUM('purchase','sale','consumption','adjustment','return'),
  qty DECIMAL(12,3),       -- positive IN, negative OUT
  unit_cost DECIMAL(12,4), -- for weighted-average valuation
  ref_type, ref_id,        -- polymorphic: reservation / purchase_order / adjustment
  user_id, note,
  created_at
```

Valuation: **weighted average** (simpler for small business than FIFO).

### Service Variants + BOM

#### `service_variants`
```sql
service_variants
  id, service_id, label,
  price DECIMAL(12,2), duration_min INT,
  sort_order, is_active
```
Replaces "create one service per car size". Vehicle type auto-suggests variant on booking.

#### `service_variant_consumption` (recipe)
```sql
service_variant_consumption
  id, service_variant_id, product_id, qty DECIMAL(12,3)
```

#### `reservation_items` (polymorphic)
```sql
reservation_items
  id, reservation_id,
  item_type ENUM('service_variant','product'),
  ref_id, qty INT,
  unit_price, line_total
```

### Reservation State Machine (extended)

```
booked → confirmed → checked_in → in_progress → completed → invoiced
                                                       └→ invoice_failed (retry)
```

Item edits allowed per state:

| State | Add | Remove | Edit price |
|---|---|---|---|
| booked | Yes | Yes | No |
| confirmed | Yes | Yes | No |
| checked_in | Yes | Yes | Yes (with permission) |
| in_progress | Yes | No (consumables already drawn) | No |
| completed | No (only Nota de Crédito) | No | No |

Every change recorded in `reservation_item_changes`:
```sql
reservation_item_changes
  id, reservation_id,
  action ENUM('added','removed','upgraded','downgraded','price_override'),
  item_type, old_ref_id, new_ref_id,
  old_price, new_price,
  reason TEXT, changed_by_user_id, changed_at
```

Stock effect by state:
- `checked_in`: BOM moves consumables to `reserved`.
- `completed`: `reserved` → `out` (real consumption movement).
- Cancel after `checked_in`: release `reserved`.
- Cancel mid `in_progress`: cashier confirms what was actually used; rest released.

### Vehicle → Variant Auto-suggest

Map on `vehicles.type`:
```
sedan, hatchback      → Pequeño
suv (small)           → Mediano
suv (large), camioneta → Grande
4x4 doble cabina, truck → Grande / Extra
```
Show soft warning if customer picks a smaller variant than vehicle suggests.

### Billing Profile

#### `user_billing_profiles`
```sql
user_billing_profiles
  id, user_id,
  doc_type ENUM('ruc','cedula','passport','final_consumer'),
  doc_number VARCHAR(13),
  legal_name, address, email, phone,
  is_default BOOLEAN,
  timestamps
```

Multiple per user (personal + employer). Validate Ecuadorian RUC (mod-11) and Cédula (mod-10) client-side.

#### Per-reservation snapshot
```sql
ALTER TABLE reservations ADD COLUMN billing_snapshot JSON
```
Captured at `checked_in`. Protects against profile edits after invoice.

**Final consumer**: `doc_type=final_consumer`, RUC `9999999999999`, only allowed up to $200 (post-reforma SRI threshold).

### SRI Invoicing Pipeline

#### `tax_profiles` (per tenant)
```sql
tax_profiles
  id, tenant_id UNIQUE,
  ruc VARCHAR(13), legal_name, trade_name,
  matriz_address, establishment_address,
  establishment_code VARCHAR(3) DEFAULT '001',
  emission_point VARCHAR(3) DEFAULT '001',
  ambiente ENUM('1','2'),    -- 1=PRUEBAS, 2=PRODUCCION
  tipo_emision ENUM('1') DEFAULT '1',  -- always NORMAL
  is_special_taxpayer BOOLEAN,
  rimpe_regime BOOLEAN,
  cert_path,                 -- encrypted P12 on disk
  cert_password_enc,         -- Laravel Crypt
  cert_expires_at,
  cert_serial,
  timestamps
```

#### `tax_sequences` (lock per tenant + doc type)
```sql
tax_sequences
  id, tenant_id,
  doc_type ENUM('factura','nota_credito','nota_debito','retencion','guia_remision'),
  current_seq BIGINT,
  UNIQUE(tenant_id, doc_type)
```
DB-level lock when incrementing — prevents gaps SRI rejects.

#### `electronic_documents`
```sql
electronic_documents
  id, tenant_id,
  doc_type ENUM(...),
  reservation_id NULL, ref_type, ref_id,
  clave_acceso VARCHAR(49) UNIQUE,  -- 49-char access key
  series VARCHAR(7),                -- establishment + emission point
  sequence VARCHAR(9),
  authorization_number VARCHAR(49),
  status ENUM('PENDIENTE','RECIBIDA','AUTORIZADA','DEVUELTA','RECHAZADA','NO_AUTORIZADA','EN_CONTINGENCIA'),
  authorized_at TIMESTAMP NULL,
  xml_raw LONGTEXT,
  xml_signed LONGTEXT,
  pdf_path,                         -- generated RIDE
  sri_response_json JSON,
  retry_count INT, last_retry_at,
  emitted_to_email,                  -- snapshot from billing_profile
  total DECIMAL(12,2), iva_total, base_iva,
  timestamps
  INDEX (tenant_id, status), INDEX (clave_acceso)
```

#### Jobs (queue chain)
1. `BuildElectronicDocumentJob` — assemble XML from reservation_items + billing_snapshot + tax_profile.
2. `SignXmlJob` — XAdES-BES with P12 cert (phpseclib + DOMDocument + openssl).
3. `SubmitToSriReceptionJob` — SOAP to WS Recepción.
4. `PollSriAuthorizationJob` — exponential backoff 3s → 10s → 30s → 1m → 5m → 30m (SRI sometimes slow).
5. `GenerateRidePdfJob` — Spatie/laravel-pdf or wkhtmltopdf, includes barcode of clave_acceso.
6. `SendDocumentToCustomerJob` — email with XML + PDF attached (Resend).

Cron `sri:retry-pending` — sweeps PENDIENTE/DEVUELTA in last 24h.

Contingency mode: if SRI down >24h, use separate `tipo_emision=2` (CONTINGENCIA) sequence per SRI rules.

### Clave de Acceso (49 chars)

Composition (SRI Resolución NAC-DGERCGC18-00000233):
```
ddMMyyyy + tipoComp(2) + ruc(13) + ambiente(1) + serie(6) + secuencial(9) + codNumerico(8) + tipoEmision(1) + dvVerificador(1)
```

`dvVerificador` = mod-11 of first 48 chars.

### XAdES-BES Signing

Stack:
- `openssl` ext + `phpseclib/phpseclib` for cert ops
- `DOMDocument` + `XSLTProcessor` for XML manipulation
- No abandoned libs — write a minimal `XAdesBesSigner` service class in `app/Infrastructure/Sri/`.

Test vectors: maintain in `tests/Feature/Sri/fixtures/` known-good signed XMLs from SRI ambiente PRUEBAS.

### Storage

- `xml_signed` in DB (LONGTEXT) for fast retrieval.
- After 90 days: move to `storage/sri/{year}/{month}/{clave_acceso}.xml.gz` cold storage on Vultr Block Storage.
- Retention: 7 years (SRI requirement). Cron monthly archive.

## Backend File Layout

```
app/
  Domain/
    Inventory/
      Entities/Product.php
      Entities/StockMovement.php
      Repositories/ProductRepository.php
      Services/StockValuator.php
    Catalog/
      Entities/ServiceVariant.php
      Entities/ServiceVariantConsumption.php
    Invoicing/
      Entities/ElectronicDocument.php
      ValueObjects/ClaveAcceso.php
      ValueObjects/Ruc.php
      Services/SriClient.php
      Services/XAdesBesSigner.php
  Application/
    UseCases/
      Inventory/
        AddPurchase.php
        AdjustStock.php
        ApplyServiceConsumption.php
      Reservations/
        CheckInReservation.php
        AddReservationItem.php
        RemoveReservationItem.php
      Invoicing/
        EmitInvoiceForReservation.php
        EmitCreditNote.php
  Infrastructure/
    Sri/
      Soap/SriRecepcionClient.php
      Soap/SriAutorizacionClient.php
      Xml/FacturaXmlBuilder.php
      Xml/NotaCreditoXmlBuilder.php
      Signer/XAdesBesSigner.php
      Ride/RidePdfRenderer.php
    Persistence/Models/{Product,StockMovement,ServiceVariant,ElectronicDocument,...}.php
    Http/Controllers/
      Inventory/{ProductController,StockMovementController}.php
      Catalog/ServiceVariantController.php
      Reservation/ReservationItemController.php
      Invoicing/TaxProfileController.php
      Invoicing/CertificateUploadController.php
      Invoicing/ElectronicDocumentController.php
```

## Frontend (admin-v2)

New pages:
- `/inventory` — product list, stock levels, low-stock alerts
- `/inventory/[id]` — product detail, movement history (kardex)
- `/inventory/purchase` — record purchase order (raises stock)
- `/services/[id]` — add variants + edit BOM (existing `services` route extended)
- `/settings/tax` — tenant tax profile + cert P12 upload
- `/invoicing` — issued documents list, status filters, re-emit failed

Reservation detail page gets:
- Inline item editor with state-aware buttons
- "Check in" CTA
- "Cerrar y facturar" modal capturing billing data if missing
- Audit log panel

## Customer App (Flutter)

- Billing profile screen: capture once, edit anytime
- Reservation flow: pre-fill from default profile, "Cambiar datos de factura para esta reserva" toggle
- Validation: cédula mod-10, RUC mod-11 client-side
- Vehicle → variant auto-suggest with soft warning

## Phases & Timeline

| Phase | Scope | With Claude Code |
|---|---|---|
| 1 | Inventory MVP: products, stock_movements, levels, basic CRUD admin UI | 3–5 days |
| 2 | Service variants + BOM + consumption on `completed` | 2–3 days |
| 3 | Reservation state machine extension + item editor + audit | 3–5 days |
| 4 | Billing profile customer app + per-reservation snapshot | 2–3 days |
| 5 | Tax profile + cert P12 upload + cert expiry warnings | 1 day |
| 6 | XML factura builder + clave_acceso + XAdES sign | 4–6 days |
| 7 | WS Recepción + Autorización (ambiente PRUEBAS) | 2–3 days |
| 8 | RIDE PDF + email customer | 1–2 days |
| 9 | Queue/retry/contingency | 2 days |
| 10 | NC, retención, guía remisión | 5–7 days |
| 11 | Real SRI PRUEBAS testing with live RUC | 1–2 weeks |

**Total wall-clock**: ~6 weeks for full SRI + inventory + workflow integration.

## Open Questions

- [ ] IVA rate: lock to 15% (current EC rate as of 2026) or per-product configurable? Recommendation: per-product, default to 15%.
- [ ] Multi-establishment per tenant — defer to v2?
- [ ] ICE (Impuesto a Consumos Especiales) — relevant for car wash? Likely no. Skip in MVP.
- [ ] Retenciones — only if tenant is `is_special_taxpayer`. Most lavadoras are not. Phase 10.
- [ ] Final-consumer threshold: SRI raised to $200; verify current rule before launch.
- [ ] Customer email validation: send a verification email when billing profile saved? Soft validate format only in MVP.

## Risks

1. **SRI schema changes** — version 2.1.0 active; SRI publishes new versions 1–2× per year. Mitigation: schema files in repo, version pinned in config.
2. **Cert expiry** — auto-notify tenant 30 days before. Block emission if expired (no fallback possible).
3. **Decimal precision** — SRI rejects sums that don't reconcile to the cent. All money math in `BCMath` or DECIMAL.
4. **SRI downtime** — observed multiple multi-hour outages. Contingency mode + retry queue.
5. **Real-world testing cost** — need at least one live RUC (Danny's or a friendly tenant) for PRODUCCIÓN environment shakedown before opening to paying tenants.

## References

- SRI Ficha Técnica Comprobantes Electrónicos v2.27: https://www.sri.gob.ec/comprobantes-electronicos
- Esquemas XSD: https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/8a47988e-1f1a-4d22-8aac-89c7a2e1b04a/FacturaV2.1.0.xsd
- Reforma RIMPE: Ley Orgánica para el Desarrollo Económico (2021), umbrales actualizados 2024.
