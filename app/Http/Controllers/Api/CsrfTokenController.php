<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class CsrfTokenController extends Controller
{
    public function __invoke(Request $request)
    {
        // Touches/initializes the session and returns the current CSRF token.
        // This lets kiosk tablets recover automatically from CSRF/session expiry without a full refresh.
        return response()
            ->json([
                'csrf_token' => csrf_token(),
            ])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
}

