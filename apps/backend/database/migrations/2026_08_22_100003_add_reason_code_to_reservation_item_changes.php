<?php
// apps/backend/database/migrations/2026_08_22_100003_add_reason_code_to_reservation_item_changes.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La auditoría de reservas ya guardaba `reason` como texto libre. El
     * código va aparte para que el reporte pueda agrupar; `reason` queda como
     * la nota.
     *
     * Nullable: las filas viejas tienen texto libre y ningún código. El
     * reporte las muestra como "Otro".
     */
    public function up(): void
    {
        Schema::table('reservation_item_changes', function (Blueprint $table) {
            $table->string('reason_code', 40)->nullable()->after('reason');
        });
    }

    public function down(): void
    {
        Schema::table('reservation_item_changes', function (Blueprint $table) {
            $table->dropColumn('reason_code');
        });
    }
};
