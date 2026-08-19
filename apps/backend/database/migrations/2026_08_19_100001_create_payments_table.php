<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cada vez que entra plata. El pago vivía dentro de la fila del servicio,
     * lo que hacía imposible dos pagos contra un servicio (abono) o un pago
     * contra varios (deuda) — y hacía que la caja del día contara precios de
     * servicios en vez de plata recibida.
     *
     * `amount` es lo que ENTRÓ, nunca el precio del servicio.
     *
     * `cash_session_id` no está acá a propósito: su tabla nace con la caja,
     * en la fase siguiente.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            // Null = walk-in sin cliente identificado, que es la mayoría.
            $table->uuid('client_id')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('method', 20);
            $table->string('bank', 40)->nullable();
            $table->timestamp('paid_at');
            $table->uuid('received_by')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('client_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('received_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['tenant_id', 'paid_at']);
            $table->index(['client_id', 'paid_at']);
            $table->index(['tenant_id', 'method', 'paid_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
