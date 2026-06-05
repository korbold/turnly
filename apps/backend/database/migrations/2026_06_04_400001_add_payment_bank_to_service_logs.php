<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            // Bank slug for transferencia payments. Free-form string
            // (pichincha, pacifico, …) so tenants can drop in regional
            // banks without a future migration.
            $table->string('payment_bank', 40)->nullable()->after('payment_method');
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropColumn('payment_bank');
        });
    }
};
