<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->enum('tax_id_type', ['ruc', 'cedula', 'pasaporte'])
                ->nullable()
                ->after('country');
            $table->string('tax_id', 20)->nullable()->after('tax_id_type');
            $table->string('legal_name', 255)->nullable()->after('tax_id');
            $table->string('billing_email', 255)->nullable()->after('legal_name');
            $table->string('billing_address', 255)->nullable()->after('billing_email');
            $table->string('billing_phone', 20)->nullable()->after('billing_address');
            $table->boolean('billing_verified')->default(false)->after('billing_phone');
            $table->timestamp('billing_verified_at')->nullable()->after('billing_verified');

            $table->index(['tax_id_type', 'tax_id']);
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropIndex(['tax_id_type', 'tax_id']);
            $table->dropColumn([
                'tax_id_type',
                'tax_id',
                'legal_name',
                'billing_email',
                'billing_address',
                'billing_phone',
                'billing_verified',
                'billing_verified_at',
            ]);
        });
    }
};
