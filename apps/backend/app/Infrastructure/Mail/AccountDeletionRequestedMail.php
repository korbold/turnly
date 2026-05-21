<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AccountDeletionRequestedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $name,
        public readonly string $deletesAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Solicitud de eliminación de cuenta · Turnly',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.account-deletion-requested',
            with: ['name' => $this->name, 'deletesAt' => $this->deletesAt],
        );
    }
}
