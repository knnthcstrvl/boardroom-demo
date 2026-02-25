<?php

namespace App\Http\Controllers\Api;

use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Mail\ReservationStatusUpdatedMail;
use App\Models\Reservation;
use App\Support\ReservationEvents;
use App\Support\ReservationApproval;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ReservationApprovalController extends Controller
{
    public function approve(Request $request, Reservation $reservation)
    {
        $user = $request->user();
        abort_unless($user->is_admin || $user->hasAccess('approver'), 403);

        if (! in_array($reservation->status, [ReservationStatus::Pending, ReservationStatus::Approved], true)) {
            return response()->json(['message' => 'Only pending reservations can be approved.'], 422);
        }

        // If one occurrence in a recurring series is approved, approve the whole pending series.
        $result = ReservationApproval::approveReservationOrSeries($reservation, $user);

        ReservationEvents::record('reservation.approved', $reservation);
        if (($result['auto_rejected'] ?? 0) > 0) {
            ReservationEvents::record('reservation.auto_rejected', $reservation);
        }

        $this->notifyRequesterSeries($reservation, (int) ($result['approved'] ?? 1));
        if (! empty($result['auto_rejected_ids'])) {
            $autoRejectedReservations = Reservation::query()
                ->whereIn('id', $result['auto_rejected_ids'])
                ->get();
            foreach ($autoRejectedReservations as $autoRejectedReservation) {
                $this->notifyRequester($autoRejectedReservation);
            }
        }

        return response()->json([
            'reservation' => $reservation->fresh()->load(['meetingRoom', 'requester', 'approver']),
            'auto_rejected' => (int) ($result['auto_rejected'] ?? 0),
            'approved' => (int) ($result['approved'] ?? 1),
        ]);
    }

    public function reject(Request $request, Reservation $reservation)
    {
        $user = $request->user();
        abort_unless($user->is_admin || $user->hasAccess('approver'), 403);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($reservation->status !== ReservationStatus::Pending) {
            return response()->json(['message' => 'Only pending reservations can be rejected.'], 422);
        }

        $seriesId = $reservation->repeat_series_id ? (string) $reservation->repeat_series_id : null;
        if (! $seriesId) {
            $reservation->status = ReservationStatus::Rejected;
            $reservation->approved_by = $user->id;
            $reservation->rejected_reason = $validated['reason'] ?? null;
            $reservation->save();

            ReservationEvents::record('reservation.rejected', $reservation);
            $this->notifyRequester($reservation);

            return response()->json($reservation->load(['meetingRoom', 'requester', 'approver']));
        }

        // If one occurrence in a recurring series is rejected, reject the whole pending series.
        $rejectedCount = 0;
        \Illuminate\Support\Facades\DB::transaction(function () use ($reservation, $seriesId, $user, $validated, &$rejectedCount) {
            $rows = Reservation::query()
                ->where('repeat_series_id', $seriesId)
                ->where('meeting_room_id', $reservation->meeting_room_id)
                ->where('status', ReservationStatus::Pending->value)
                ->lockForUpdate()
                ->get();

            foreach ($rows as $r) {
                $r->status = ReservationStatus::Rejected;
                $r->approved_by = $user->id;
                $r->rejected_reason = $validated['reason'] ?? null;
                $r->save();
                $rejectedCount++;
            }
        });

        ReservationEvents::record('reservation.rejected', $reservation);
        $this->notifyRequesterSeries($reservation, max(1, $rejectedCount));

        return response()->json([
            'reservation' => $reservation->fresh()->load(['meetingRoom', 'requester', 'approver']),
            'rejected' => (int) $rejectedCount,
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
