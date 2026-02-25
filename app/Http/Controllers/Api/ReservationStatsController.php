<?php

namespace App\Http\Controllers\Api;

use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Models\Reservation;
use Illuminate\Http\Request;

class ReservationStatsController extends Controller
{
    public function __invoke(Request $request)
    {
        $user = $request->user();
        abort_unless($user && ($user->is_admin || $user->hasAccess('approver') || $user->hasAccess('view')), 403);

        // Count pending items as "requests", not raw occurrences:
        // - non-recurring reservations count as 1
        // - recurring series counts as 1 (by repeat_series_id)
        $pending = (int) Reservation::query()
            ->where('status', ReservationStatus::Pending->value)
            ->selectRaw("COUNT(DISTINCT COALESCE(repeat_series_id, CONCAT('single-', id))) as pending")
            ->value('pending');

        return response()->json([
            'pending' => $pending,
        ]);
    }
}
