<?php

namespace App\Support;

use App\Models\Reservation;
use Illuminate\Support\Facades\DB;

class ReservationEvents
{
    public static function record(string $type, ?Reservation $reservation = null): void
    {
        DB::table('reservation_events')->insert([
            'type' => $type,
            'reservation_id' => $reservation?->id,
            'meeting_room_id' => $reservation?->meeting_room_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}

