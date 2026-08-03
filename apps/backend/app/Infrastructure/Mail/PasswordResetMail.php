<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Queue\SerializesModels;

class PasswordResetMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $name,
        public string $resetUrl,
        public int $ttlMinutes = 60,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Restablece tu contraseña de Turnly',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.password-reset',
            text: 'emails.password-reset-text',
            with: [
                'name' => $this->name,
                'resetUrl' => $this->resetUrl,
                'ttlMinutes' => $this->ttlMinutes,
            ],
        );
    }

    public function headers(): Headers
    {
        return new Headers(
            messageId: sprintf('<%s.%s@goturnly.com>', bin2hex(random_bytes(8)), time()),
            text: [
                'X-Entity-Ref-ID' => bin2hex(random_bytes(16)),
                'X-Auto-Response-Suppress' => 'All',
                'Precedence' => 'transactional',
            ],
        );
    }
}
