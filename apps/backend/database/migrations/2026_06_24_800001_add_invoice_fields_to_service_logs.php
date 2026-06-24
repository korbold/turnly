<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->string('invoice_external_id')->nullable()->after('invoiced_at');
            $table->string('invoice_status', 20)->nullable()->after('invoice_external_id');
            $table->char('invoice_clave_acceso', 49)->nullable()->after('invoice_status');
            $table->string('invoice_numero_autorizacion')->nullable()->after('invoice_clave_acceso');
            $table->text('invoice_error')->nullable()->after('invoice_numero_autorizacion');
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropColumn([
                'invoice_external_id',
                'invoice_status',
                'invoice_clave_acceso',
                'invoice_numero_autorizacion',
                'invoice_error',
            ]);
        });
    }
};
