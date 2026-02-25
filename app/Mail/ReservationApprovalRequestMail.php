<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\URL;

class ReservationApprovalRequestMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $approveUrl;
    public string $rejectUrl;

    public function __construct(
        public Reservation $reservation,
        public string $approverEmail,
        public ?int $seriesCount = null,
    )
    {
        $this->approveUrl = URL::temporarySignedRoute(
            name: 'email.reservations.approve',
            expiration: now()->addDays(3),
            parameters: ['reservation' => $reservation->id, 'approver' => $approverEmail]
        );

        $this->rejectUrl = URL::temporarySignedRoute(
            name: 'email.reservations.reject',
            expiration: now()->addDays(3),
            parameters: ['reservation' => $reservation->id, 'approver' => $approverEmail]
        );
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'BoardRoom reservation approval needed',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.reservation-approval-request',
            with: [
                'reservation' => $this->reservation,
                'approveUrl' => $this->approveUrl,
                'rejectUrl' => $this->rejectUrl,
                'seriesCount' => $this->seriesCount,
            ],
        );
    }
}
