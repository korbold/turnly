<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `payment_status` era enum('unpaid','paid'). El abono necesita 'partial'.
     *
     * Pasa a string(20) en vez de a un enum más ancho por la misma razón por
     * la que `service_staff.position` es string: SQLite (los tests) no sabe
     * alterar enums, y la próxima vez que haga falta un valor nuevo esto
     * volvería a ser una migración imposible de correr en test. La validación
     * vive en el request y en el servicio de aplicación.
     */
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->string('payment_status', 20)->default('unpaid')->change();
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->enum('payment_status', ['unpaid', 'paid'])->default('unpaid')->change();
        });
    }
};
