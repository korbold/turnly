<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lo que separa una deuda de un olvido.
     *
     * Sin esta marca, "deuda" sería todo servicio impago — y cada "cobrar al
     * retirar" que nadie cerró se convertiría en deudor. La lista pierde
     * credibilidad en un mes y el dueño vuelve al cuaderno.
     *
     * El default es false y se escribe explícitamente al completar: el cajero
     * responde "¿cobrás o se va debiendo?" en el único momento en que sabe la
     * respuesta.
     */
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->boolean('left_owing')->default(false)->after('payment_status');
            // La consulta caliente: los deudores de un tenant.
            $table->index(['tenant_id', 'left_owing', 'payment_status']);
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'left_owing', 'payment_status']);
            $table->dropColumn('left_owing');
        });
    }
};
