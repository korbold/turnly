<?php

declare(strict_types=1);

namespace App\Infrastructure\Jobs;

use App\Events\InvoiceStatusUpdated;
use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Mail\InvoiceMail;
use App\Infrastructure\Notifications\Notifications\InvoiceAuthorized;
use App\Infrastructure\Notifications\Notifications\InvoiceRejected;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
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

/**
 * Service-log counterpart of SyncReservationInvoiceStatusJob: polls the billing
 * service until the SRI invoice is authorized (or rejected), mirrors the status
 * onto the service log, and emails the client the invoice (PDF + XML).
 */
class SyncServiceLogInvoiceStatusJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const MAX_ATTEMPTS = 8;

    public int $tries = 1;

    public function __construct(
        public readonly string $serviceLogId,
        public readonly int $attempt = 1,
    ) {}

    public function handle(BillingServiceClient $client): void
    {
        $log = ServiceLogModel::with('clientResource.client')->find($this->serviceLogId);

        if (!$log || empty($log->invoice_external_id)) {
            return;
        }

        if ($log->invoice_status === 'autorizada') {
            return;
        }

        try {
            $inv = $client->getInvoice($log->invoice_external_id);
        } catch (Throwable $e) {
            $this->reschedule();
            return;
        }

        $estado = $inv['estado'] ?? null;

        if ($estado === 'autorizada') {
            $log->update([
                'invoice_status'              => 'autorizada',
                'invoice_numero_autorizacion' => $inv['numero_autorizacion'] ?? $log->invoice_numero_autorizacion,
                'invoice_error'               => null,
            ]);

            $this->broadcast($log);

            $email = $log->clientResource?->client?->email;
            if ($email && !empty($inv['id'])) {
                Mail::to($email)->queue(new InvoiceMail(
                    clientEmail:       $email,
                    externalInvoiceId: $inv['id'],
                    invoiceNumber:     $inv['numero_autorizacion'] ?? $inv['id'],
                    issuedAt:          now()->format('d/m/Y'),
                    businessName:      $this->tenantName($log->tenant_id),
                ));
            }

            $this->notifyAdmins($log->tenant_id, new InvoiceAuthorized(
                (string) $log->tenant_id,
                $this->tenantName($log->tenant_id),
                'invoice',
                (string) $log->id,
                (string) ($log->invoice_numero_autorizacion ?? ($inv['numero_autorizacion'] ?? '')),
            ));

            return;
        }

        if (in_array($estado, ['rechazada', 'devuelta', 'no_autorizada'], true)) {
            $log->update([
                'invoice_status' => 'rechazada',
                'invoice_error'  => $this->firstMessage($inv),
            ]);

            $this->broadcast($log);

            $this->notifyAdmins($log->tenant_id, new InvoiceRejected(
                (string) $log->tenant_id,
                $this->tenantName($log->tenant_id),
                'invoice',
                (string) $log->id,
                $this->firstMessage($inv),
            ));

            return;
        }

        $this->reschedule();
    }

    private function reschedule(): void
    {
        if ($this->attempt >= self::MAX_ATTEMPTS) {
            return;
        }

        self::dispatch($this->serviceLogId, $this->attempt + 1)
            ->delay(now()->addSeconds(min(60, 10 * $this->attempt)));
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

    private function firstMessage(array $inv): ?string
    {
        $messages = $inv['sri_response']['mensajes'] ?? $inv['mensajes'] ?? null;
        if (is_array($messages) && isset($messages[0]['mensaje'])) {
            return (string) $messages[0]['mensaje'];
        }

        return null;
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
            \Illuminate\Support\Facades\Log::warning('Invoice admin notification failed', ['error' => $e->getMessage()]);
        }
    }

    private function tenantName(string $tenantId): string
    {
        return (string) (TenantModel::find($tenantId)?->name ?? '');
    }
}
