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
