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
        public readonly string $businessName = '',
    ) {}

    public function envelope(): Envelope
    {
        $subject = $this->businessName !== ''
            ? "Tu factura emitida por {$this->businessName}"
            : 'Tu factura electrónica';

        return new Envelope(subject: $subject);
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
        $client   = app(BillingServiceClient::class);
        $safeName = str_replace('/', '-', $this->invoiceNumber);
        $items    = [];

        // RIDE PDF and XML are fetched independently — one failing must not
        // drop the other from the email.
        try {
            $pdfBytes = $client->getInvoiceRide($this->externalInvoiceId);
            $items[]  = Attachment::fromData(fn () => $pdfBytes, "factura-{$safeName}.pdf")
                ->withMime('application/pdf');
        } catch (Throwable $e) {
            Log::warning('InvoiceMail: failed to fetch RIDE PDF', [
                'invoice_id' => $this->externalInvoiceId,
                'error'      => $e->getMessage(),
            ]);
        }

        try {
            $xmlBytes = $client->getInvoiceXml($this->externalInvoiceId);
            $items[]  = Attachment::fromData(fn () => $xmlBytes, "factura-{$safeName}.xml")
                ->withMime('application/xml');
        } catch (Throwable $e) {
            Log::warning('InvoiceMail: failed to fetch XML', [
                'invoice_id' => $this->externalInvoiceId,
                'error'      => $e->getMessage(),
            ]);
        }

        return $items;
    }
}
