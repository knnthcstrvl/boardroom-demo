<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('meeting_rooms')->where('name', 'Board Room')->exists();

        if (! $exists) {
            DB::table('meeting_rooms')->insert([
                'name' => 'Board Room',
                'timezone' => config('app.timezone'),
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('meeting_rooms')->where('name', 'Board Room')->delete();
    }
};

