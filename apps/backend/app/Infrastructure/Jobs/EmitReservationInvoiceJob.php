<?php

declare(strict_types=1);

namespace App\Infrastructure\Jobs;

use App\Domain\Billing\ConsumidorFinalLimit;
use App\Events\InvoiceStatusUpdated;
use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Mail\InvoiceMail;
use App\Infrastructure\Notifications\Notifications\InvoiceAuthorized;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Throwable;

class EmitReservationInvoiceJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly string $reservationId) {}

    public function handle(BillingServiceClient $client): void
    {
        $reservation = ReservationModel::with(['items', 'service', 'variant', 'client'])->findOrFail($this->reservationId);

        $billingProfile = $this->resolveBillingProfile($reservation->billing_snapshot);

        // Invoice-on-payment reaches this job without passing the
        // controller's check, so the rule is enforced here too. Recording
        // the reason instead of throwing keeps the 3 retries from firing
        // against a verdict that will never change.
        $ivaMode = TenantModel::find($reservation->tenant_id)?->settings['iva_mode'] ?? 'excluded';

        if (ConsumidorFinalLimit::blocks(
            $billingProfile['tipo'] === '07',
            ConsumidorFinalLimit::totalWithIva($this->grossTotal($reservation), $ivaMode),
        )) {
            $reservation->update([
                'invoice_status' => 'rechazada',
                'invoice_error'  => ConsumidorFinalLimit::MESSAGE,
            ]);

            $this->broadcast($reservation);

            return;
        }

        // SRI Tabla 24 (formas de pago): 01 sin sistema financiero (efectivo),
        // 16 tarjeta de débito/crédito, 20 otros con utilización del sistema
        // financiero (transferencia). Transfer must be 20 — not 16.
        $formaPago = match ($reservation->payment_method) {
            'cash'     => '01',
            'card'     => '16',
            'transfer' => '20',
            default    => '20',
        };

        $payload = [
            'tenant_id'                     => $reservation->tenant_id,
            'external_ref_id'               => $reservation->id,
            'tipo_identificacion_comprador' => $billingProfile['tipo'],
            'razon_social_comprador'        => $billingProfile['legal_name'],
            'identificacion_comprador'      => $billingProfile['doc_number'],
            'direccion_comprador'           => $billingProfile['address'] ?? null,
            'forma_pago'                    => $formaPago,
            'items'                         => $this->buildItems($reservation),
        ];

        try {
            $result = $client->emitInvoice($payload);

            $reservation->update([
                'invoice_external_id'         => $result['id'] ?? null,
                'invoice_status'              => $result['estado'] ?? 'enviada',
                'invoice_clave_acceso'        => $result['clave_acceso'] ?? null,
                'invoice_numero_autorizacion' => $result['numero_autorizacion'] ?? null,
                'invoice_error'               => null,
                'invoiced'                    => true,
                'invoiced_at'                 => now(),
            ]);

            $this->broadcast($reservation);

            if (($result['estado'] ?? '') === 'autorizada') {
                $email = $reservation->client?->email;
                if ($email && !empty($result['id'])) {
                    Mail::to($email)->queue(new InvoiceMail(
                        clientEmail:       $email,
                        externalInvoiceId: $result['id'],
                        invoiceNumber:     $result['numero_autorizacion'] ?? $result['id'],
                        issuedAt:          now()->format('d/m/Y'),
                        businessName:      $this->tenantName($reservation->tenant_id),
                    ));
                }

                $this->notifyAdmins($reservation->tenant_id, new InvoiceAuthorized(
                    (string) $reservation->tenant_id,
                    $this->tenantName($reservation->tenant_id),
                    'reservation_detail',
                    (string) $reservation->id,
                    (string) ($result['numero_autorizacion'] ?? ''),
                ));
            } elseif (!empty($result['id'])) {
                // SRI authorization is async — poll the billing service until the
                // invoice is authorized (or rejected) and then email the client.
                SyncReservationInvoiceStatusJob::dispatch($reservation->id)
                    ->delay(now()->addSeconds(15));
            }
        } catch (Throwable $e) {
            $reservation->update([
                'invoice_status' => 'rechazada',
                'invoice_error'  => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function broadcast(ReservationModel $reservation): void
    {
        try {
            InvoiceStatusUpdated::dispatch(
                (string) $reservation->tenant_id,
                'reservation',
                (string) $reservation->id,
                $reservation->invoice_external_id,
                (string) $reservation->invoice_status,
                $reservation->invoice_numero_autorizacion,
                $reservation->invoice_clave_acceso,
            );
        } catch (Throwable $e) {
            Log::warning('InvoiceStatusUpdated broadcast failed', ['error' => $e->getMessage()]);
        }
    }

    private function notifyAdmins(string $tenantId, \Illuminate\Notifications\Notification $notification): void
    {
        try {
            $admins = TenantModel::find($tenantId)?->users()
                ->wherePivotIn('role', ['owner', 'tenant_admin', 'cashier'])
                ->wherePivot('is_active', true)
                ->get();

            if ($admins && $admins->isNotEmpty()) {
                Notification::send($admins, $notification);
            }
        } catch (\Throwable $e) {
            Log::warning('Invoice admin notification failed', ['error' => $e->getMessage()]);
        }
    }

    private function tenantName(string $tenantId): string
    {
        return (string) (TenantModel::find($tenantId)?->name ?? '');
    }

    private function resolveBillingProfile(?array $snapshot): array
    {
        if ($snapshot && ($snapshot['doc_type'] ?? 'final_consumer') !== 'final_consumer') {
            return [
                'tipo'       => $this->tipoIdentificacion($snapshot['doc_type']),
                'doc_number' => $snapshot['doc_number'],
                'legal_name' => $snapshot['legal_name'],
                'address'    => $snapshot['address'] ?? null,
            ];
        }

        return [
            'tipo'       => '07',
            'doc_number' => '9999999999999',
            'legal_name' => 'CONSUMIDOR FINAL',
            'address'    => null,
        ];
    }

    private function tipoIdentificacion(string $docType): string
    {
        return match ($docType) {
            'ruc'      => '04',
            'cedula'   => '05',
            'passport' => '06',
            default    => '07',
        };
    }

    /** Displayed total (pre-IVA adjustment), same shape buildItems bills. */
    private function grossTotal(ReservationModel $reservation): float
    {
        if ($reservation->items && $reservation->items->isNotEmpty()) {
            return (float) $reservation->items->sum(
                fn ($item) => (float) $item->unit_price * (float) $item->qty,
            );
        }

        return (float) ($reservation->variant?->price ?? $reservation->service?->price ?? 0);
    }

    private function buildItems(ReservationModel $reservation): array
    {
        $tenant  = TenantModel::find($reservation->tenant_id);
        $ivaMode = $tenant?->settings['iva_mode'] ?? 'excluded';
        $codIva  = $ivaMode === 'zero' ? '0' : '4';

        // When prices already include IVA, back-calculate the net unit price
        // (price / 1.15) so SRI re-adds the tax to the same displayed total.
        $netPrice = fn (float $unit): float => $ivaMode === 'included' ? round($unit / 1.15, 6) : $unit;

        if ($reservation->items && $reservation->items->isNotEmpty()) {
            return $reservation->items->map(fn ($item) => [
                'descripcion'           => (string) $item->label,
                'cantidad'              => (float) $item->qty,
                'precio_unitario'       => $netPrice((float) $item->unit_price),
                'descuento'             => 0.0,
                'codigo_porcentaje_iva' => $codIva,
            ])->values()->all();
        }

        $price = (float) ($reservation->variant?->price ?? $reservation->service?->price ?? 0);
        $description = $reservation->variant
            ? ($reservation->service?->name . ' - ' . $reservation->variant->name)
            : ($reservation->service?->name ?? 'Servicio');

        return [[
            'descripcion'           => $description,
            'cantidad'              => 1.0,
            'precio_unitario'       => $netPrice($price),
            'descuento'             => 0.0,
            'codigo_porcentaje_iva' => $codIva,
        ]];
    }
}
