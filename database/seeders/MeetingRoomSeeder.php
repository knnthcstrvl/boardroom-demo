<?php

namespace Database\Seeders;

use App\Models\MeetingRoom;
use Illuminate\Database\Seeder;

class MeetingRoomSeeder extends Seeder
{
    public function run(): void
    {
        MeetingRoom::query()->updateOrCreate(
            ['name' => 'Board Room'],
            [
                'timezone' => config('app.timezone'),
                'is_active' => true,
            ]
        );
    }
}

