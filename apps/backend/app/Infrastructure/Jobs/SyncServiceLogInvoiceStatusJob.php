<?php

declare(strict_types=1);

namespace App\Infrastructure\Jobs;

use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Mail\InvoiceMail;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
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

            $email = $log->clientResource?->client?->email;
            if ($email && !empty($inv['id'])) {
                Mail::to($email)->queue(new InvoiceMail(
                    clientEmail:       $email,
                    externalInvoiceId: $inv['id'],
                    invoiceNumber:     $inv['numero_autorizacion'] ?? $inv['id'],
                    issuedAt:          now()->format('d/m/Y'),
                ));
            }

            return;
        }

        if (in_array($estado, ['rechazada', 'devuelta', 'no_autorizada'], true)) {
            $log->update([
                'invoice_status' => 'rechazada',
                'invoice_error'  => $this->firstMessage($inv),
            ]);

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

    private function firstMessage(array $inv): ?string
    {
        $messages = $inv['sri_response']['mensajes'] ?? $inv['mensajes'] ?? null;
        if (is_array($messages) && isset($messages[0]['mensaje'])) {
            return (string) $messages[0]['mensaje'];
        }

        return null;
    }
}
