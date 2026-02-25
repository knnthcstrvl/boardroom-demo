<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->boolean('repeat_enabled')->default(false)->after('rejected_reason');
            $table->unsignedInteger('repeat_weeks')->nullable()->after('repeat_enabled');
            $table->json('repeat_days')->nullable()->after('repeat_weeks'); // 1=Mon..5=Fri
            $table->date('repeat_start_date')->nullable()->after('repeat_days');
            $table->uuid('repeat_series_id')->nullable()->after('repeat_start_date')->index();
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn([
                'repeat_enabled',
                'repeat_weeks',
                'repeat_days',
                'repeat_start_date',
                'repeat_series_id',
            ]);
        });
    }
};

