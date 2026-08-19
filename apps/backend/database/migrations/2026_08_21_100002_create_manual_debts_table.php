<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Las deudas que el dueño ya lleva anotadas fuera del sistema.
     *
     * Sin esto la pantalla de deudores arranca en cero para gente que sí
     * debe, el dueño sigue usando el cuaderno y la feature no sirve.
     *
     * No se cargan como servicios retroactivos a propósito: inventar
     * servicios que nunca ocurrieron ensucia los reportes de producción y el
     * consumo de inventario para siempre.
     */
    public function up(): void
    {
        Schema::create('manual_debts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            // Al menos uno de los dos. La placa alcanza para un walk-in; el
            // cliente aparece cuando el recurso lo tiene.
            $table->uuid('client_resource_id')->nullable();
            $table->uuid('client_id')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('reason', 200);
            // Cuándo se generó, no cuándo se cargó: el dueño carga en agosto
            // una deuda de junio, y el reparto FIFO la tiene que poner
            // primero. `created_at` responde la otra pregunta.
            $table->date('incurred_on');
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('client_resource_id')->references('id')->on('client_resources')->nullOnDelete();
            $table->foreign('client_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['tenant_id', 'client_resource_id']);
            $table->index(['tenant_id', 'client_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manual_debts');
    }
};
