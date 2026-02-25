<?php

namespace App\Http\Controllers;

use App\Enums\ReservationStatus;
use App\Mail\ReservationStatusUpdatedMail;
use App\Models\Reservation;
use App\Models\User;
use App\Support\ReservationApproval;
use App\Support\ReservationEvents;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ReservationEmailActionController extends Controller
{
    private function approverUser(string $email): User
    {
        $user = User::query()
            ->where('email', $email)
            ->where(function ($q) {
                $q->where('is_admin', true)->orWhereJsonContains('access', 'approver');
            })
            ->first();

        abort_unless((bool) $user, 403);

        return $user;
    }

    public function approve(Request $request, Reservation $reservation)
    {
        $approverEmail = (string) $request->query('approver');
        abort_if($approverEmail === '', 403);
        $approver = $this->approverUser($approverEmail);

        if (! in_array($reservation->status, [ReservationStatus::Pending, ReservationStatus::Approved], true)) {
            return view('reservations.email-action-result', [
                'title' => 'Nothing to do',
                'message' => 'This reservation is no longer pending.',
            ]);
        }

        $result = ReservationApproval::approveReservationOrSeries($reservation, $approver);

        ReservationEvents::record('reservation.approved_via_email', $reservation);

        if (($result['auto_rejected'] ?? 0) > 0) {
            ReservationEvents::record('reservation.auto_rejected', $reservation);
        }

        $this->notifyRequesterSeries($reservation, (int) ($result['approved'] ?? 1));
        if (! empty($result['auto_rejected_ids'])) {
            $autoRejected = Reservation::query()->whereIn('id', $result['auto_rejected_ids'])->get();
            foreach ($autoRejected as $other) {
                $this->notifyRequester($other);
            }
        }

        return view('reservations.email-action-result', [
            'title' => 'Approved',
            'message' => ($result['approved'] ?? 1) > 1 ? 'The recurring reservations have been approved.' : 'The reservation has been approved.',
        ]);
    }

    public function reject(Request $request, Reservation $reservation)
    {
        $approverEmail = (string) $request->query('approver');
        abort_if($approverEmail === '', 403);
        $approver = $this->approverUser($approverEmail);

        if ($reservation->status !== ReservationStatus::Pending) {
            return view('reservations.email-action-result', [
                'title' => 'Nothing to do',
                'message' => 'This reservation is no longer pending.',
            ]);
        }

        $reason = trim((string) $request->query('reason'));
        $reason = $reason === '' ? null : $reason;

        $seriesId = $reservation->repeat_series_id ? (string) $reservation->repeat_series_id : null;
        if (! $seriesId) {
            $reservation->status = ReservationStatus::Rejected;
            $reservation->approved_by = $approver->id;
            $reservation->rejected_reason = $reason;
            $reservation->save();

            ReservationEvents::record('reservation.rejected_via_email', $reservation);
            $this->notifyRequester($reservation);

            return view('reservations.email-action-result', [
                'title' => 'Disapproved',
                'message' => 'The reservation has been disapproved.',
            ]);
        }

        $rejectedCount = 0;
        \Illuminate\Support\Facades\DB::transaction(function () use ($reservation, $seriesId, $approver, $reason, &$rejectedCount) {
            $rows = Reservation::query()
                ->where('repeat_series_id', $seriesId)
                ->where('meeting_room_id', $reservation->meeting_room_id)
                ->where('status', ReservationStatus::Pending->value)
                ->lockForUpdate()
                ->get();

            foreach ($rows as $r) {
                $r->status = ReservationStatus::Rejected;
                $r->approved_by = $approver->id;
                $r->rejected_reason = $reason;
                $r->save();
                $rejectedCount++;
            }
        });

        ReservationEvents::record('reservation.rejected_via_email', $reservation);
        $this->notifyRequesterSeries($reservation, max(1, $rejectedCount));

        return view('reservations.email-action-result', [
            'title' => 'Disapproved',
            'message' => $rejectedCount > 1 ? 'The recurring reservations have been disapproved.' : 'The reservation has been disapproved.',
        ]);
    }

    private function notifyRequester(Reservation $reservation): void
    {
        $email = $reservation->requester_email ?: $reservation->requester?->email;
        if (! $email) {
            return;
        }

        Mail::to($email)->queue(new ReservationStatusUpdatedMail($reservation->fresh(['meetingRoom', 'requester', 'approver'])));
    }

    private function notifyRequesterSeries(Reservation $reservation, int $count): void
    {
        $email = $reservation->requester_email ?: $reservation->requester?->email;
        if (! $email) {
            return;
        }

        Mail::to($email)->queue(new ReservationStatusUpdatedMail(
            $reservation->fresh(['meetingRoom', 'requester', 'approver']),
            seriesCount: $count
        ));
    }
}
