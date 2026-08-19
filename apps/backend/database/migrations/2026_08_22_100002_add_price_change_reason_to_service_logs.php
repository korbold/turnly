<?php
// apps/backend/database/migrations/2026_08_22_100002_add_price_change_reason_to_service_logs.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * El motivo va en el ticket, no en la línea: en el mostrador nadie escribe
     * tres motivos para tres servicios del mismo cliente.
     *
     * `price_change_note` sólo se llena cuando el código es `otro`. Es string
     * y no enum por la misma razón que el resto del proyecto: SQLite no sabe
     * alterar enums, y agregar un motivo volvería a ser una migración
     * imposible de correr en test.
     */
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->string('price_change_reason', 40)->nullable()->after('price_charged');
            $table->string('price_change_note', 200)->nullable()->after('price_change_reason');
            $table->index(['tenant_id', 'price_change_reason']);
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'price_change_reason']);
            $table->dropColumn(['price_change_reason', 'price_change_note']);
        });
    }
};
