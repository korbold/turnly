<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->boolean('invoiced')->default(false)->after('payment_bank');
            $table->timestamp('invoiced_at')->nullable()->after('invoiced');
            $table->string('invoice_external_id')->nullable()->after('invoiced_at');
            $table->string('invoice_status', 30)->nullable()->after('invoice_external_id');
            $table->string('invoice_clave_acceso', 49)->nullable()->after('invoice_status');
            $table->string('invoice_numero_autorizacion', 49)->nullable()->after('invoice_clave_acceso');
            $table->text('invoice_error')->nullable()->after('invoice_numero_autorizacion');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn([
                'invoiced', 'invoiced_at', 'invoice_external_id',
                'invoice_status', 'invoice_clave_acceso',
                'invoice_numero_autorizacion', 'invoice_error',
            ]);
        });
    }
};
