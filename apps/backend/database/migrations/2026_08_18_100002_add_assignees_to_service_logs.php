<?php
// apps/backend/database/migrations/2026_08_18_100002_add_assignees_to_service_logs.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Quién lavó y quién secó, apuntando al catálogo service_staff.
     *
     * `attended_by` queda intacta: sigue siendo "quién atendió/registró" y
     * conserva la regla que la pisa con el id del cajero (anti-fraude de
     * comisiones). Separar las columnas es lo que permite tener las dos
     * verdades sin que una destruya a la otra.
     *
     * restrictOnDelete y no nullOnDelete: perder el nombre de quien lavó es
     * exactamente el daño que estas columnas existen para evitar.
     */
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->uuid('washed_by')->nullable()->after('attended_by');
            $table->uuid('dried_by')->nullable()->after('washed_by');

            $table->foreign('washed_by')->references('id')->on('service_staff')->restrictOnDelete();
            $table->foreign('dried_by')->references('id')->on('service_staff')->restrictOnDelete();

            $table->index('washed_by');
            $table->index('dried_by');
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropForeign(['washed_by']);
            $table->dropForeign(['dried_by']);
            $table->dropIndex(['washed_by']);
            $table->dropIndex(['dried_by']);
            $table->dropColumn(['washed_by', 'dried_by']);
        });
    }
};
