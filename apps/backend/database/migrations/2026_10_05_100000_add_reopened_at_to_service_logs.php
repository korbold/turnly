<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un registro completado se reabre cuando se le agrega un servicio. La marca
 * sobrevive al volver a completarlo: quien ya trabajó en ese auto quedó
 * asentado, y reabrir no le da al cajero la llave para reescribirlo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->timestamp('reopened_at')->nullable()->after('finished_at');
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropColumn('reopened_at');
        });
    }
};
