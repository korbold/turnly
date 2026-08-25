<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * El conteo por denominación: cuántos billetes de cada valor y cuántas
     * monedas había en el cajón.
     *
     * Pedir un total en un campo vacío deja que ese número salga de cualquier
     * lado — el arqueo del 24 de agosto en FEDER declaró exactamente el
     * efectivo cobrado, que no es lo que había en el cajón. Preguntar
     * "cuántos billetes de $20" obliga a contarlos.
     *
     * Guardar el detalle y no sólo la suma es lo que permite reconstruir un
     * arqueo discutido: "conté $54.20" no dice si faltó un billete de $20 o
     * veinte monedas de a peso.
     *
     * Nullable porque los cierres viejos no lo tienen y siguen siendo válidos.
     */
    public function up(): void
    {
        Schema::table('cash_sessions', function (Blueprint $table) {
            $table->json('counted_breakdown')->nullable()->after('counted_amount');
        });

        Schema::table('cash_session_closures', function (Blueprint $table) {
            $table->json('counted_breakdown')->nullable()->after('counted_amount');
        });
    }

    public function down(): void
    {
        Schema::table('cash_sessions', function (Blueprint $table) {
            $table->dropColumn('counted_breakdown');
        });

        Schema::table('cash_session_closures', function (Blueprint $table) {
            $table->dropColumn('counted_breakdown');
        });
    }
};
