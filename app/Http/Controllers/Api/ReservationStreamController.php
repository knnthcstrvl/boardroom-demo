<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReservationStreamController extends Controller
{
    public function __invoke(Request $request)
    {
        $lastEventId = (int) ($request->header('Last-Event-ID') ?: $request->query('lastEventId', 0));
        $meetingRoomId = $request->query('meeting_room_id');

        $timeoutSeconds = 25;

        return response()->stream(function () use ($lastEventId, $meetingRoomId, $timeoutSeconds) {
            $start = time();
            $cursor = $lastEventId;

            while (true) {
                if ((time() - $start) >= $timeoutSeconds) {
                    echo ": timeout\n\n";
                    @ob_flush();
                    @flush();
                    return;
                }

                $query = DB::table('reservation_events')
                    ->where('id', '>', $cursor)
                    ->orderBy('id')
                    ->limit(50);

                if ($meetingRoomId !== null && $meetingRoomId !== '') {
                    $query->where(function ($q) use ($meetingRoomId) {
                        $q->whereNull('meeting_room_id')->orWhere('meeting_room_id', (int) $meetingRoomId);
                    });
                }

                $events = $query->get(['id', 'type', 'reservation_id', 'meeting_room_id', 'created_at']);

                if ($events->isEmpty()) {
                    echo ": heartbeat\n\n";
                    @ob_flush();
                    @flush();
                    usleep(900_000);
                    continue;
                }

                foreach ($events as $event) {
                    $cursor = (int) $event->id;
                    echo "id: {$cursor}\n";
                    echo "event: reservation.changed\n";
                    echo 'data: '.json_encode([
                        'id' => $cursor,
                        'type' => $event->type,
                        'reservation_id' => $event->reservation_id,
                        'meeting_room_id' => $event->meeting_room_id,
                        'created_at' => $event->created_at,
                    ])."\n\n";
                }

                @ob_flush();
                @flush();
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}

