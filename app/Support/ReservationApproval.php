<?php

namespace App\Support;

use App\Enums\ReservationStatus;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReservationApproval
{
    /**
     * Approves a single reservation or (if recurring) the whole pending series.
     *
     * All-or-nothing: if any occurrence conflicts with an existing approved reservation,
     * nothing is approved.
     *
     * @return array{approved:int, auto_rejected:int, auto_rejected_ids:array<int,int>, series_updated:int, series_id:?string}
     */
    public static function approveReservationOrSeries(Reservation $reservation, User $approver): array
    {
        $seriesId = $reservation->repeat_series_id ? (string) $reservation->repeat_series_id : null;

        if (! $seriesId) {
            return DB::transaction(function () use ($reservation, $approver) {
                self::assertNoApprovedConflicts([$reservation]);

                $reservation->status = ReservationStatus::Approved;
                $reservation->approved_by = $approver->id;
                $reservation->rejected_reason = null;
                $reservation->save();

                $autoRejected = self::autoRejectOverlaps([$reservation], $approver, seriesId: null);

                return [
                    'approved' => 1,
                    'auto_rejected' => $autoRejected['count'],
                    'auto_rejected_ids' => $autoRejected['ids'],
                    'series_updated' => 1,
                    'series_id' => null,
                ];
            });
        }

        return DB::transaction(function () use ($reservation, $approver, $seriesId) {
            $seriesReservations = Reservation::query()
                ->where('repeat_series_id', $seriesId)
                ->where('meeting_room_id', $reservation->meeting_room_id)
                ->where('status', ReservationStatus::Pending->value)
                ->orderBy('start_at')
                ->lockForUpdate()
                ->get();

            if ($seriesReservations->isEmpty()) {
                return [
                    'approved' => 0,
                    'auto_rejected' => 0,
                    'series_updated' => 0,
                    'series_id' => $seriesId,
                ];
            }

            self::assertNoApprovedConflicts($seriesReservations->all());

            foreach ($seriesReservations as $r) {
                $r->status = ReservationStatus::Approved;
                $r->approved_by = $approver->id;
                $r->rejected_reason = null;
                $r->save();
            }

            $autoRejected = self::autoRejectOverlaps($seriesReservations->all(), $approver, seriesId: $seriesId);

            return [
                'approved' => $seriesReservations->count(),
                'auto_rejected' => $autoRejected['count'],
                'auto_rejected_ids' => $autoRejected['ids'],
                'series_updated' => $seriesReservations->count(),
                'series_id' => $seriesId,
            ];
        });
    }

    /**
     * @param  array<int, Reservation>  $occurrences
     */
    private static function assertNoApprovedConflicts(array $occurrences): void
    {
        if (empty($occurrences)) {
            return;
        }

        $roomId = $occurrences[0]->meeting_room_id;
        $minStart = null;
        $maxEnd = null;

        foreach ($occurrences as $r) {
            $start = Carbon::parse($r->start_at);
            $end = Carbon::parse($r->end_at);
            $minStart = $minStart ? $minStart->min($start) : $start;
            $maxEnd = $maxEnd ? $maxEnd->max($end) : $end;
        }

        $approved = Reservation::query()
            ->where('meeting_room_id', $roomId)
            ->where('status', ReservationStatus::Approved->value)
            ->where('start_at', '<', $maxEnd)
            ->where('end_at', '>', $minStart)
            ->get(['id', 'start_at', 'end_at', 'title']);

        foreach ($occurrences as $r) {
            foreach ($approved as $a) {
                $rStart = Carbon::parse($r->start_at);
                $rEnd = Carbon::parse($r->end_at);
                $aStart = Carbon::parse($a->start_at);
                $aEnd = Carbon::parse($a->end_at);

                if ($rStart->lt($aEnd) && $rEnd->gt($aStart)) {
                    abort(422, 'Cannot approve: one or more occurrences conflict with an approved reservation.');
                }
            }
        }
    }

    /**
     * Auto-reject other pending reservations that overlap any approved occurrence.
     *
     * @param  array<int, Reservation>  $approvedOccurrences
     */
    /**
     * @return array{count:int, ids:array<int,int>}
     */
    private static function autoRejectOverlaps(array $approvedOccurrences, User $approver, ?string $seriesId): array
    {
        $rejectedIds = [];

        foreach ($approvedOccurrences as $approved) {
            $query = Reservation::query()
                ->where('meeting_room_id', $approved->meeting_room_id)
                ->where('status', ReservationStatus::Pending->value)
                ->where('start_at', '<', $approved->end_at)
                ->where('end_at', '>', $approved->start_at)
                ->where('id', '!=', $approved->id);

            if ($seriesId) {
                $query->where(function ($q) use ($seriesId) {
                    $q->whereNull('repeat_series_id')->orWhere('repeat_series_id', '!=', $seriesId);
                });
            }

            $others = $query->get(['id']);
            foreach ($others as $o) {
                $rejectedIds[$o->id] = true;
            }
        }

        $ids = array_values(array_keys($rejectedIds));
        if (empty($ids)) {
            return ['count' => 0, 'ids' => []];
        }

        $count = Reservation::query()
            ->whereIn('id', $ids)
            ->update([
                'status' => ReservationStatus::Rejected->value,
                'approved_by' => $approver->id,
                'rejected_reason' => 'Time slot was approved for another request.',
                'updated_at' => now(),
            ]);

        return ['count' => $count, 'ids' => $ids];
    }
}
