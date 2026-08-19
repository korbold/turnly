<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Plata que entra o sale del cajón sin ser un cobro.
     *
     * Tres tipos en una tabla con enum, no tres tablas: `expense` es un gasto
     * (almuerzo, insumos), `withdrawal` es el dueño llevándose la recaudación
     * — sale del cajón pero NO es un gasto, y mezclarlos ensucia cualquier
     * reporte de gastos futuro con cifras que no lo son — y `deposit` es el
     * espejo, reposición de cambio.
     *
     * `amount` es siempre positivo; el signo lo pone `type`.
     */
    public function up(): void
    {
        Schema::create('cash_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('cash_session_id');
            $table->string('type', 12);
            $table->decimal('amount', 12, 2);
            $table->string('reason', 200);
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('cash_session_id')->references('id')->on('cash_sessions')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['cash_session_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_movements');
    }
};
