<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->index(['meeting_room_id', 'status', 'start_at', 'end_at'], 'reservations_room_status_range_idx');
        });

        Schema::table('reservation_events', function (Blueprint $table) {
            $table->index(['meeting_room_id', 'id'], 'reservation_events_room_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropIndex('reservations_room_status_range_idx');
        });

        Schema::table('reservation_events', function (Blueprint $table) {
            $table->dropIndex('reservation_events_room_id_idx');
        });
    }
};

