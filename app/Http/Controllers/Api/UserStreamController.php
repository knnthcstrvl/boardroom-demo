<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserStreamController extends Controller
{
    public function __invoke(Request $request)
    {
        $actor = $request->user();
        abort_unless($actor?->is_admin || $actor?->hasAnyAccess(['add', 'edit', 'delete']), 403);

        $lastEventId = (int) ($request->header('Last-Event-ID') ?: $request->query('lastEventId', 0));

        $timeoutSeconds = 25;

        return response()->stream(function () use ($lastEventId, $timeoutSeconds) {
            $start = time();
            $cursor = $lastEventId;

            while (true) {
                if ((time() - $start) >= $timeoutSeconds) {
                    echo ": timeout\n\n";
                    @ob_flush();
                    @flush();
                    return;
                }

                $events = DB::table('user_events')
                    ->where('id', '>', $cursor)
                    ->orderBy('id')
                    ->limit(50)
                    ->get(['id', 'type', 'user_id', 'created_at']);

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
                    echo "event: user.changed\n";
                    echo 'data: '.json_encode([
                        'id' => $cursor,
                        'type' => $event->type,
                        'user_id' => $event->user_id,
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
