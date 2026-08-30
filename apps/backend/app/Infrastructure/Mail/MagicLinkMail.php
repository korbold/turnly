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

class MagicLinkMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $email,
        public string $magicUrl,
        public int $ttlMinutes = 15,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Tu link para entrar a Turnly',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.magic-link',
            text: 'emails.magic-link-text',
            with: [
                'email' => $this->email,
                'magicUrl' => $this->magicUrl,
                'ttlMinutes' => $this->ttlMinutes,
            ],
        );
    }

    public function headers(): Headers
    {
        // Marks the message as transactional one-shot for Gmail/Outlook
        // (no marketing signals, dedupe key, single-recipient hint).
        return new Headers(
            // Sin ángulos: Symfony los agrega. Pasarlos ya puestos deja una
            // cabecera que no cumple RFC 2822, y el correo no sale — así estuvo
            // el link de entrada al portal desde el 3 de julio de 2026.
            messageId: sprintf('%s.%s@goturnly.com', bin2hex(random_bytes(8)), time()),
            text: [
                'X-Entity-Ref-ID' => bin2hex(random_bytes(16)),
                'X-Auto-Response-Suppress' => 'All',
                'Precedence' => 'transactional',
            ],
        );
    }
}
