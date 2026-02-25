<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MeetingRoom;

class MeetingRoomController extends Controller
{
    public function index()
    {
        $boardRoom = MeetingRoom::query()->firstOrCreate(
            ['name' => 'Board Room'],
            [
                'timezone' => config('app.timezone'),
                'is_active' => true,
            ]
        );

        if (! $boardRoom->is_active) {
            $boardRoom->is_active = true;
            $boardRoom->save();
        }

        return MeetingRoom::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'timezone']);
    }
}
