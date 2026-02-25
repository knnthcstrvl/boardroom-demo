<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('microsoft_avatar_mime', 80)->nullable()->after('access');
            $table->longText('microsoft_avatar_base64')->nullable()->after('microsoft_avatar_mime');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['microsoft_avatar_mime', 'microsoft_avatar_base64']);
        });
    }
};

