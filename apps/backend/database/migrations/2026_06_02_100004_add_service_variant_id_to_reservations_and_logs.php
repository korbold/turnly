<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->uuid('service_variant_id')->nullable()->after('service_id');
            // Idempotency flag for ConsumptionEngine — set when we apply
            // BOM consumption on `complete` so a retry never double-counts.
            $table->timestamp('consumption_applied_at')->nullable();
            $table->foreign('service_variant_id')
                ->references('id')->on('service_variants')->nullOnDelete();
        });

        Schema::table('service_logs', function (Blueprint $table) {
            $table->uuid('service_variant_id')->nullable()->after('service_id');
            $table->timestamp('consumption_applied_at')->nullable();
            $table->foreign('service_variant_id')
                ->references('id')->on('service_variants')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropForeign(['service_variant_id']);
            $table->dropColumn(['service_variant_id', 'consumption_applied_at']);
        });
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropForeign(['service_variant_id']);
            $table->dropColumn(['service_variant_id', 'consumption_applied_at']);
        });
    }
};
