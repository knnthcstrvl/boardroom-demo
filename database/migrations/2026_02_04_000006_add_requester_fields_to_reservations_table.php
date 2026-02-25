<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropForeign(['requested_by']);
        });

        DB::statement('ALTER TABLE reservations MODIFY requested_by BIGINT UNSIGNED NULL');

        Schema::table('reservations', function (Blueprint $table) {
            $table->foreign('requested_by')->references('id')->on('users')->cascadeOnDelete();
            $table->string('requester_email')->nullable()->after('requested_by');
            $table->string('requester_department')->nullable()->after('requester_email');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropForeign(['requested_by']);
            $table->dropColumn(['requester_email', 'requester_department']);
        });

        DB::statement('ALTER TABLE reservations MODIFY requested_by BIGINT UNSIGNED NOT NULL');

        Schema::table('reservations', function (Blueprint $table) {
            $table->foreign('requested_by')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
