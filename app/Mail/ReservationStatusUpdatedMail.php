<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ReservationStatusUpdatedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Reservation $reservation, public ?int $seriesCount = null)
    {
    }

    public function envelope(): Envelope
    {
        $status = ucfirst((string) $this->reservation->status->value);

        return new Envelope(
            subject: "BoardRoom reservation {$status}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.reservation-status-updated',
            with: [
                'reservation' => $this->reservation,
                'kioskUrl' => url('/kiosk'),
                'seriesCount' => $this->seriesCount,
            ],
        );
    }
}
