<?php
// apps/backend/database/migrations/2026_08_22_100001_add_catalog_price_to_service_log_items.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lo que el catálogo decía EN EL MOMENTO del registro.
     *
     * Es una foto, no una consulta. Sin ella el reporte miente: si mañana el
     * lavado sube de $15 a $18, todos los cobros de $15 de hoy aparecerían
     * como descuentos de $3.
     *
     * Nullable porque las filas históricas no la tienen, y una fila sin
     * catálogo NO es un descuento: es una fila vieja. El reporte la ignora.
     */
    public function up(): void
    {
        Schema::table('service_log_items', function (Blueprint $table) {
            $table->decimal('catalog_price', 12, 2)->nullable()->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('service_log_items', function (Blueprint $table) {
            $table->dropColumn('catalog_price');
        });
    }
};
