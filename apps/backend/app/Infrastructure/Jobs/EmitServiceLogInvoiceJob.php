<?php

declare(strict_types=1);

namespace App\Infrastructure\Jobs;

use App\Domain\Billing\ConsumidorFinalLimit;
use App\Events\InvoiceStatusUpdated;
use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Mail\InvoiceMail;
use App\Infrastructure\Notifications\Notifications\InvoiceAuthorized;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
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

        // Invoice-on-payment reaches this job without passing the
        // controller's check, so the rule is enforced here too. Recording
        // the reason instead of throwing keeps the 3 retries from firing
        // against a verdict that will never change.
        $ivaMode = TenantModel::find($log->tenant_id)?->settings['iva_mode'] ?? 'excluded';

        if (ConsumidorFinalLimit::blocks(
            $billingProfile['tipo'] === '07',
            ConsumidorFinalLimit::totalWithIva((float) $log->price_charged, $ivaMode),
        )) {
            $log->update([
                'invoice_status' => 'rechazada',
                'invoice_error'  => ConsumidorFinalLimit::MESSAGE,
            ]);

            $this->broadcast($log);

            return;
        }

        // SRI Tabla 24 (formas de pago): 01 sin sistema financiero (efectivo),
        // 16 tarjeta de débito/crédito, 20 otros con utilización del sistema
        // financiero (transferencia). Transfer must be 20 — not 16.
        $formaPago = match ($log->payment_method) {
            'cash'     => '01',
            'card'     => '16',
            'transfer' => '20',
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

            $this->broadcast($log);

            if (($result['estado'] ?? '') === 'autorizada') {
                // Prefer the fiscal profile's email (the one the cashier can
                // correct), falling back to the client's account email.
                $email = ($billingProfile['email'] ?? null) ?: $log->clientResource?->client?->email;
                if ($email && !empty($result['id'])) {
                    Mail::to($email)->queue(new InvoiceMail(
                        clientEmail:       $email,
                        externalInvoiceId: $result['id'],
                        invoiceNumber:     $result['numero_autorizacion'] ?? $result['id'],
                        issuedAt:          now()->format('d/m/Y'),
                        businessName:      $this->tenantName($log->tenant_id),
                    ));
                }

                $this->notifyAdmins($log->tenant_id, new InvoiceAuthorized(
                    (string) $log->tenant_id,
                    $this->tenantName($log->tenant_id),
                    'invoice',
                    (string) $log->id,
                    (string) ($result['numero_autorizacion'] ?? ''),
                ));
            } elseif (!empty($result['id'])) {
                // SRI authorization is async — poll until authorized, then email.
                SyncServiceLogInvoiceStatusJob::dispatch($log->id)
                    ->delay(now()->addSeconds(15));
            }
        } catch (Throwable $e) {
            $log->update([
                'invoice_status' => 'rechazada',
                'invoice_error'  => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function broadcast(ServiceLogModel $log): void
    {
        try {
            InvoiceStatusUpdated::dispatch(
                (string) $log->tenant_id,
                'service_log',
                (string) $log->id,
                $log->invoice_external_id,
                (string) $log->invoice_status,
                $log->invoice_numero_autorizacion,
                $log->invoice_clave_acceso,
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
                    'email'      => $profile->email,
                ];
            }
        }

        return [
            'tipo'       => '07',
            'doc_number' => '9999999999999',
            'legal_name' => 'CONSUMIDOR FINAL',
            'address'    => null,
            'email'      => null,
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
        $tenant = TenantModel::find($log->tenant_id);
        $ivaMode = $tenant?->settings['iva_mode'] ?? 'excluded';

        $codIva = $ivaMode === 'zero' ? '0' : '4';

        if ($log->items && $log->items->isNotEmpty()) {
            return $log->items->map(function ($item) use ($ivaMode, $codIva) {
                $unit = (float) $item->unit_price;
                return [
                    'descripcion'           => (string) $item->label,
                    'cantidad'              => (float) $item->qty,
                    'precio_unitario'       => $ivaMode === 'included' ? round($unit / 1.15, 6) : $unit,
                    'descuento'             => 0.0,
                    'codigo_porcentaje_iva' => $codIva,
                ];
            })->values()->all();
        }

        $description = $log->service?->name ?? 'Servicio';
        $unitPrice = (float) $log->price_charged;

        return [[
            'descripcion'           => $description,
            'cantidad'              => 1.0,
            'precio_unitario'       => $ivaMode === 'included' ? round($unitPrice / 1.15, 6) : $unitPrice,
            'descuento'             => 0.0,
            'codigo_porcentaje_iva' => $codIva,
        ]];
    }
}
