<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\MicrosoftAuthController;
use App\Http\Controllers\SpaController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserAvatarController;
use App\Http\Controllers\Api\UserStreamController;
use App\Http\Controllers\Api\MeetingRoomController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\ReservationApprovalController;
use App\Http\Controllers\Api\ReservationStreamController;
use App\Http\Controllers\Api\ReservationStatsController;
use App\Http\Controllers\Api\CsrfTokenController;
use App\Http\Controllers\ReservationEmailActionController;

Route::get('/', function () {
    return redirect('/kiosk');
});

Route::get('/login', function () {
    if (auth()->check()) {
        return redirect('/kiosk');
    }

    return view('auth.login');
})->name('login');

Route::get('/auth/microsoft/redirect', [MicrosoftAuthController::class, 'redirect'])->name('auth.microsoft.redirect');
Route::get('/auth/microsoft/callback', [MicrosoftAuthController::class, 'callback'])->name('auth.microsoft.callback');

Route::post('/logout', [MicrosoftAuthController::class, 'logout'])->middleware('auth')->name('logout');
Route::post('/auth/demo-admin', [MicrosoftAuthController::class, 'demoAdminLogin'])
    ->middleware('throttle:10,1')
    ->name('auth.demo-admin');

Route::get('/email/reservations/{reservation}/approve', [ReservationEmailActionController::class, 'approve'])
    ->middleware('signed')
    ->name('email.reservations.approve');
Route::get('/email/reservations/{reservation}/reject', [ReservationEmailActionController::class, 'reject'])
    ->middleware('signed')
    ->name('email.reservations.reject');

Route::prefix('/api')->group(function () {
    Route::get('/csrf', CsrfTokenController::class);
    Route::get('/meeting-rooms', [MeetingRoomController::class, 'index']);

    Route::get('/stream/reservations', ReservationStreamController::class);

    Route::get('/reservations', [ReservationController::class, 'index']);
    Route::post('/reservations', [ReservationController::class, 'store']);
    Route::get('/reservations/{reservation}', [ReservationController::class, 'show']);
    Route::put('/reservations/{reservation}', [ReservationController::class, 'update']);
    Route::post('/reservations/{reservation}/reschedule', [ReservationController::class, 'reschedule']);
});

Route::middleware('auth')->prefix('/api')->group(function () {
    Route::get('/me', MeController::class);

    Route::get('/stream/users', UserStreamController::class);

    Route::post('/reservations/{reservation}/cancel', [ReservationController::class, 'cancel']);

    Route::post('/reservations/{reservation}/approve', [ReservationApprovalController::class, 'approve']);
    Route::post('/reservations/{reservation}/reject', [ReservationApprovalController::class, 'reject']);

    Route::apiResource('users', UserController::class);
    Route::get('/users/{user}/avatar', UserAvatarController::class);
    Route::get('/reservations/stats', ReservationStatsController::class);
});

Route::middleware('auth')->group(function () {
    Route::get('/admin/{path?}', SpaController::class)->where('path', '.*')->name('admin');
});

Route::get('/kiosk', SpaController::class)->name('kiosk');
