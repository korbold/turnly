<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->boolean('invoiced')->default(false)->after('paid_at');
            $table->timestamp('invoiced_at')->nullable()->after('invoiced');
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropColumn(['invoiced', 'invoiced_at']);
        });
    }
};
