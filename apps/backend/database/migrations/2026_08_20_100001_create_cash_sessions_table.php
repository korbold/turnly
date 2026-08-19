<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La caja del día: una base al abrir, un conteo al cerrar, y la
     * diferencia entre lo contado y lo que el sistema esperaba.
     *
     * `expected_amount` y `difference` nacen NULL y se escriben recién al
     * cerrar. No es pereza: es el cierre ciego. Si el esperado estuviera
     * disponible mientras la caja está abierta, el cajero escribiría ese
     * número en el conteo y el control sería teatro.
     *
     * `status` es string y no enum por la misma razón que `payment_status`
     * en la fase 1: SQLite (los tests) no sabe alterar enums.
     */
    public function up(): void
    {
        Schema::create('cash_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            // El día del negocio, no el timestamp: una caja abierta 08:12 y
            // cerrada 21:40 es una sola cosa, y "la caja del lunes" tiene que
            // poder buscarse por esa fecha.
            $table->date('business_date');

            $table->uuid('opened_by')->nullable();
            $table->timestamp('opened_at');
            $table->decimal('opening_amount', 12, 2)->default(0);

            $table->uuid('closed_by')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->decimal('counted_amount', 12, 2)->nullable();
            $table->decimal('expected_amount', 12, 2)->nullable();
            $table->decimal('difference', 12, 2)->nullable();

            $table->string('status', 10)->default('open');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('opened_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('closed_by')->references('id')->on('users')->nullOnDelete();

            // Una caja por día del negocio. Es la regla del spec, y en la base
            // en vez de sólo en el servicio porque dos pestañas abiertas a la
            // vez son el caso real.
            $table->unique(['tenant_id', 'business_date']);
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_sessions');
    }
};
