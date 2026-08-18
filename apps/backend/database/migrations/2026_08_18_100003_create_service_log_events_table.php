<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bitácora append-only del servicio: registro, asignación de lavador y
     * secador, edición de items, cobro, completado y facturación. Existe
     * para defender un reclamo del dueño del vehículo semanas después —
     * incluido el caso en que alguien corrija un dato justo después de que
     * el reclamo entró.
     *
     * `detail` es json porque cada evento carga una forma distinta y ninguna
     * consulta filtra por su contenido: se lee siempre por service_log_id en
     * orden cronológico.
     *
     * Mismas convenciones que reservation_item_changes.
     */
    public function up(): void
    {
        Schema::create('service_log_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('service_log_id');
            $table->string('event', 40);
            $table->json('detail')->nullable();
            // Null = lo hizo el sistema (el veredicto del SRI, vía job).
            $table->uuid('changed_by_user_id')->nullable();
            $table->timestamp('changed_at')->useCurrent();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('service_log_id')->references('id')->on('service_logs')->cascadeOnDelete();
            $table->foreign('changed_by_user_id')->references('id')->on('users')->nullOnDelete();

            $table->index(['service_log_id', 'changed_at']);
            $table->index(['tenant_id', 'changed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_log_events');
    }
};
