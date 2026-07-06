<?php

declare(strict_types=1);

namespace App\Infrastructure\Jobs;

use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Mail\InvoiceMail;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
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

        $formaPago = match ($reservation->payment_method) {
            'cash'     => '01',
            'card'     => '16',
            'transfer' => '16',
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

    private function buildItems(ReservationModel $reservation): array
    {
        if ($reservation->items && $reservation->items->isNotEmpty()) {
            return $reservation->items->map(fn ($item) => [
                'descripcion'           => (string) $item->label,
                'cantidad'              => (float) $item->qty,
                'precio_unitario'       => (float) $item->unit_price,
                'descuento'             => 0.0,
                'codigo_porcentaje_iva' => '4',
            ])->values()->all();
        }

        $price = $reservation->variant?->price ?? $reservation->service?->price ?? 0;
        $description = $reservation->variant
            ? ($reservation->service?->name . ' - ' . $reservation->variant->name)
            : ($reservation->service?->name ?? 'Servicio');

        return [[
            'descripcion'           => $description,
            'cantidad'              => 1.0,
            'precio_unitario'       => (float) $price,
            'descuento'             => 0.0,
            'codigo_porcentaje_iva' => '4',
        ]];
    }
}
