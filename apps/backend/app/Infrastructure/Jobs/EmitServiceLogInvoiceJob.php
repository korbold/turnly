<?php

declare(strict_types=1);

namespace App\Infrastructure\Jobs;

use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Mail\InvoiceMail;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Throwable;

class EmitServiceLogInvoiceJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly string $serviceLogId) {}

    public function handle(BillingServiceClient $client): void
    {
        $log = ServiceLogModel::with(['items', 'service', 'clientResource.client'])->findOrFail($this->serviceLogId);

        $billingProfile = $this->resolveBillingProfile($log->clientResource);

        $formaPago = match ($log->payment_method) {
            'cash'     => '01',
            'card'     => '16',
            'transfer' => '16',
            default    => '20',
        };

        $items = $this->buildItems($log);

        $payload = [
            'tenant_id'                       => $log->tenant_id,
            'external_ref_id'                 => $log->id,
            'tipo_identificacion_comprador'   => $billingProfile['tipo'],
            'razon_social_comprador'          => $billingProfile['legal_name'],
            'identificacion_comprador'        => $billingProfile['doc_number'],
            'direccion_comprador'             => $billingProfile['address'] ?? null,
            'forma_pago'                      => $formaPago,
            'items'                           => $items,
        ];

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
            $log->update([
                'invoice_status' => 'rechazada',
                'invoice_error'  => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function resolveBillingProfile(?ClientResourceModel $clientResource): array
    {
        if ($clientResource && $clientResource->client) {
            $profile = UserBillingProfileModel::where('user_id', $clientResource->client->id)
                ->where('is_default', true)
                ->first();

            if ($profile) {
                return [
                    'tipo'       => $this->tipoIdentificacion($profile->doc_type),
                    'doc_number' => $profile->doc_number,
                    'legal_name' => $profile->legal_name,
                    'address'    => $profile->address,
                ];
            }
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

    private function buildItems(ServiceLogModel $log): array
    {
        if ($log->items && $log->items->isNotEmpty()) {
            return $log->items->map(fn ($item) => [
                'descripcion'           => (string) $item->label,
                'cantidad'              => (float) $item->qty,
                'precio_unitario'       => (float) $item->unit_price,
                'descuento'             => 0.0,
                'codigo_porcentaje_iva' => '4',
            ])->values()->all();
        }

        $description = $log->service?->name ?? 'Servicio';

        return [[
            'descripcion'           => $description,
            'cantidad'              => 1.0,
            'precio_unitario'       => (float) $log->price_charged,
            'descuento'             => 0.0,
            'codigo_porcentaje_iva' => '4',
        ]];
    }
}
