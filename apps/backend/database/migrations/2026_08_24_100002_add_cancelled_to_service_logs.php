<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Anular un registro en vez de borrarlo.
 *
 * Eliminar era físico: la fila desaparecía con sus líneas y su bitácora, y no
 * quedaba ni quién ni cuándo. En una pantalla que lleva caja, era la única
 * operación del sistema sin testigo. Anulado deja la fila visible, congelada y
 * fuera de los totales — la evidencia de que existió es justamente el punto.
 *
 * `cancelled` ya es el vocabulario de la casa: las reservas lo usan igual.
 *
 * `status` pasa de enum a string por la misma razón que `payment_status` en su
 * momento: SQLite (los tests) no sabe alterar enums, y el próximo valor nuevo
 * volvería a ser una migración imposible de correr en test. La lista válida
 * vive en el request y en el dominio.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->string('status', 20)->default('in_progress')->change();

            $table->timestamp('cancelled_at')->nullable();
            $table->uuid('cancelled_by')->nullable();
            // El motivo es lista cerrada, como los del precio: sin código, en
            // un mes "anulado" no dice nada y el reporte no agrupa.
            $table->string('cancel_reason_code', 30)->nullable();
            $table->string('cancel_reason_note', 200)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropColumn(['cancelled_at', 'cancelled_by', 'cancel_reason_code', 'cancel_reason_note']);
            $table->enum('status', ['in_progress', 'completed'])->default('in_progress')->change();
        });
    }
};
