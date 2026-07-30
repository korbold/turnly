<?php

declare(strict_types=1);

namespace App\Infrastructure\Jobs;

use App\Events\InvoiceStatusUpdated;
use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Mail\InvoiceMail;
use App\Infrastructure\Notifications\Notifications\InvoiceAuthorized;
use App\Infrastructure\Notifications\Notifications\InvoiceRejected;
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

/**
 * SRI authorization is asynchronous: the emit call returns RECIBIDA/enviada,
 * and the billing service polls SRI a few seconds later to obtain AUTORIZADO.
 * This job bridges that gap on the Turnly side — it polls the billing service
 * until the invoice reaches a terminal state, mirrors it onto the reservation,
 * and sends the client the invoice email (PDF + XML) once authorized.
 */
class SyncReservationInvoiceStatusJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Stop polling after this many attempts (~a few minutes of backoff). */
    private const MAX_ATTEMPTS = 8;

    public int $tries = 1;

    public function __construct(
        public readonly string $reservationId,
        public readonly int $attempt = 1,
    ) {}

    public function handle(BillingServiceClient $client): void
    {
        $reservation = ReservationModel::with('client')->find($this->reservationId);

        if (!$reservation || empty($reservation->invoice_external_id)) {
            return;
        }

        // Already terminal — nothing to do (email was sent on the transition).
        if ($reservation->invoice_status === 'autorizada') {
            return;
        }

        try {
            $inv = $client->getInvoice($reservation->invoice_external_id);
        } catch (Throwable $e) {
            $this->reschedule();
            return;
        }

        $estado = $inv['estado'] ?? null;

        if ($estado === 'autorizada') {
            $reservation->update([
                'invoice_status'              => 'autorizada',
                'invoice_numero_autorizacion' => $inv['numero_autorizacion'] ?? $reservation->invoice_numero_autorizacion,
                'invoice_error'               => null,
            ]);

            $this->broadcast($reservation);

            $email = $reservation->client?->email;
            if ($email && !empty($inv['id'])) {
                Mail::to($email)->queue(new InvoiceMail(
                    clientEmail:       $email,
                    externalInvoiceId: $inv['id'],
                    invoiceNumber:     $inv['numero_autorizacion'] ?? $inv['id'],
                    issuedAt:          now()->format('d/m/Y'),
                    businessName:      $this->tenantName($reservation->tenant_id),
                ));
            }

            $this->notifyAdmins($reservation->tenant_id, new InvoiceAuthorized(
                (string) $reservation->tenant_id,
                $this->tenantName($reservation->tenant_id),
                'reservation_detail',
                (string) $reservation->id,
                (string) ($reservation->invoice_numero_autorizacion ?? ($inv['numero_autorizacion'] ?? '')),
            ));

            return;
        }

        if (in_array($estado, ['rechazada', 'devuelta', 'no_autorizada'], true)) {
            $reservation->update([
                'invoice_status' => 'rechazada',
                'invoice_error'  => $this->firstMessage($inv),
            ]);

            $this->broadcast($reservation);

            $this->notifyAdmins($reservation->tenant_id, new InvoiceRejected(
                (string) $reservation->tenant_id,
                $this->tenantName($reservation->tenant_id),
                'reservation_detail',
                (string) $reservation->id,
                $this->firstMessage($inv),
            ));

            return;
        }

        // Still processing (enviada / recibida / en_proceso) — keep polling.
        $this->reschedule();
    }

    private function reschedule(): void
    {
        if ($this->attempt >= self::MAX_ATTEMPTS) {
            return;
        }

        self::dispatch($this->reservationId, $this->attempt + 1)
            ->delay(now()->addSeconds(min(60, 10 * $this->attempt)));
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
