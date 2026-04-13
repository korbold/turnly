<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_resources', function (Blueprint $table) {
            $table->dropColumn('label');
        });
    }

    public function down(): void
    {
        Schema::table('client_resources', function (Blueprint $table) {
            $table->string('label', 255)->nullable()->after('client_id');
        });
    }
};
