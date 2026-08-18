<?php
// apps/backend/database/migrations/2026_08_18_100001_create_service_staff_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Catálogo de personal que ejecuta el trabajo sin ser usuario de la app:
     * en una lavadora, quién lava y quién seca. No son cuentas — no tienen
     * login, no cuentan contra max_employees del plan, y agregar uno es
     * escribir un nombre.
     *
     * Nombre genérico a propósito: el mismo shape sirve para barbero/ayudante
     * si otro rubro lo pide. Las etiquetas en español viven en la UI.
     *
     * Sin borrado: is_active saca a alguien de los selects sin romper el
     * historial de los servicios que ya hizo, que es justamente el punto.
     */
    public function up(): void
    {
        Schema::create('service_staff', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name', 120);
            $table->string('position', 20)->default('both');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->index(['tenant_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_staff');
    }
};
