<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La fase 1 dejó esta columna afuera a propósito: su FK apunta a
     * `cash_sessions`, que no existía. Ahora sí.
     *
     * Nullable y sin backfill: los pagos históricos no pertenecen a ninguna
     * sesión porque no había sesiones, y un cobro hecho hoy sin caja abierta
     * tampoco — la caja no bloquea el mostrador.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->uuid('cash_session_id')->nullable()->after('received_by');
            $table->foreign('cash_session_id')->references('id')->on('cash_sessions')->nullOnDelete();
            $table->index(['cash_session_id', 'method']);
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['cash_session_id']);
            $table->dropIndex(['cash_session_id', 'method']);
            $table->dropColumn('cash_session_id');
        });
    }
};
