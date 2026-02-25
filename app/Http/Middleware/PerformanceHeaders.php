<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class PerformanceHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('app.debug')) {
            return $next($request);
        }

        $queryCount = 0;
        $queryTimeMs = 0.0;

        DB::listen(function ($event) use (&$queryCount, &$queryTimeMs) {
            $queryCount++;
            $queryTimeMs += (float) ($event->time ?? 0);
        });

        $start = microtime(true);

        /** @var Response $response */
        $response = $next($request);

        $durationMs = (int) round((microtime(true) - $start) * 1000);

        $response->headers->set('X-Query-Count', (string) $queryCount);
        $response->headers->set('X-Query-Time-Ms', (string) (int) round($queryTimeMs));
        $response->headers->set('X-Response-Time-Ms', (string) $durationMs);

        return $response;
    }
}

