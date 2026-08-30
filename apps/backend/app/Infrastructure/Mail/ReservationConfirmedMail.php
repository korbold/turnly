<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Lo que el paso final del asistente venía prometiendo sin cumplir.
 *
 * Lleva el magic link adentro: tocarlo mete al cliente al portal ya logueado,
 * sin escribir nada, y de paso prueba que la casilla es suya. Es el registro,
 * cobrado después de reservar en vez de antes.
 *
 * Recibe valores sueltos, no el modelo: la cola serializa esto y una reserva
 * que cambia de estado entre el encolado y el envío mandaría un correo que ya
 * no describe nada.
 */
class ReservationConfirmedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $tenantName,
        public string $servicesLabel,
        public \DateTimeInterface $scheduledAt,
        public int $durationMin,
        public bool $isConfirmed,
        public string $magicUrl,
        public ?string $address = null,
        public ?string $phone = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Tu cita en {$this->tenantName} · {$this->shortWhen()}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.reservation-confirmed',
            text: 'emails.reservation-confirmed-text',
            with: [
                'tenantName' => $this->tenantName,
                'servicesLabel' => $this->servicesLabel,
                'when' => $this->longWhen(),
                'durationMin' => $this->durationMin,
                'isConfirmed' => $this->isConfirmed,
                'magicUrl' => $this->magicUrl,
                'address' => $this->address,
                'phone' => $this->phone,
            ],
        );
    }

    /** "sáb 30, 13:00" — para el asunto, que se lee en una lista. */
    private function shortWhen(): string
    {
        return \Carbon\Carbon::instance(
            \DateTime::createFromInterface($this->scheduledAt)
        )->locale('es')->translatedFormat('D j M, H:i');
    }

    /** "sábado 30 de agosto, 13:00" — para el cuerpo. */
    private function longWhen(): string
    {
        return \Carbon\Carbon::instance(
            \DateTime::createFromInterface($this->scheduledAt)
        )->locale('es')->translatedFormat('l j \d\e F, H:i');
    }
}
