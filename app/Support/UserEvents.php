<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class UserEvents
{
    public static function record(string $type, ?User $user = null): void
    {
        try {
            if (! Schema::hasTable('user_events')) {
                return;
            }

            DB::table('user_events')->insert([
                'type' => $type,
                'user_id' => $user?->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable) {
            // Never break core flows (login/create/update/delete) if event table isn't available.
        }
    }
}
