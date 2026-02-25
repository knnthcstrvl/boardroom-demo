<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class SpaController extends Controller
{
    public function __invoke(Request $request)
    {
        $user = $request->user();

        $title = 'BoardRoom';
        if ($request->is('kiosk')) {
            $title = 'BoardRoom | Kiosk';
        } elseif ($request->is('admin') || $request->is('admin/*')) {
            if ($request->is('admin/users') || $request->is('admin/users/*')) {
                $title = 'BoardRoom | User Management';
            } elseif ($request->is('admin/reservations') || $request->is('admin/reservations/*')) {
                $title = 'BoardRoom | Reservation';
            } elseif ($request->is('admin/settings') || $request->is('admin/settings/*')) {
                $title = 'BoardRoom | Settings';
            } else {
                $title = 'BoardRoom | Dashboard';
            }
        }

        $authUser = $user ? [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_admin' => (bool) $user->is_admin,
            'access' => $user->access ?? [],
        ] : null;

        return view('app', [
            'authUser' => $authUser,
            'title' => $title,
        ]);
    }
}
