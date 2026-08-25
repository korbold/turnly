<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cada arqueo que se firmó sobre una caja, incluidos los que después se
     * reabrieron.
     *
     * Existe porque cerrar la caja antes de que termine el día tiene que
     * poder deshacerse —el 24 de agosto FEDER cerró a las 18:35 con 8
     * servicios sin cobrar por $305, y a las 18:56 cobraron uno— pero el
     * conteo ya declarado no puede evaporarse cuando eso pasa. Un arqueo es
     * el único número del sistema que alguien comparó contra billetes de
     * verdad: si reabrir lo borrara, sería una goma sobre el control.
     *
     * La sesión guarda el último cierre en sus propias columnas (es lo que
     * las pantallas leen); esta tabla guarda todos, en orden.
     */
    public function up(): void
    {
        Schema::create('cash_session_closures', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('cash_session_id');

            $table->decimal('counted_amount', 12, 2);
            $table->decimal('expected_amount', 12, 2);
            $table->decimal('difference', 12, 2);

            $table->uuid('closed_by')->nullable();
            $table->timestamp('closed_at');
            $table->text('notes')->nullable();

            // Quién lo reabrió y por qué. NULL mientras este cierre siga en
            // pie: el último de la lista es el vigente.
            $table->uuid('reopened_by')->nullable();
            $table->timestamp('reopened_at')->nullable();
            $table->string('reopen_reason', 200)->nullable();

            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('cash_session_id')->references('id')->on('cash_sessions')->cascadeOnDelete();
            $table->foreign('closed_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('reopened_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['tenant_id', 'cash_session_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_session_closures');
    }
};
