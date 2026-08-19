<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Contra qué se aplica cada pago. Polimórfica desde el día uno:
     * `reservations` arrastra el mismo problema y va a entrar después, y
     * agregarle polimorfismo más tarde obliga a un backfill de filas ya
     * escritas.
     *
     * Invariante que el servicio de aplicación sostiene: la suma de las
     * asignaciones de un pago nunca supera su monto. Lo que sobra es saldo a
     * favor del cliente.
     */
    public function up(): void
    {
        Schema::create('payment_allocations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('payment_id');
            $table->string('payable_type', 30);
            $table->uuid('payable_id');
            $table->decimal('amount', 12, 2);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('payment_id')->references('id')->on('payments')->cascadeOnDelete();

            // La consulta caliente: "cuánto se pagó de este servicio".
            $table->index(['payable_type', 'payable_id']);
            $table->index(['tenant_id', 'payable_type', 'payable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_allocations');
    }
};
