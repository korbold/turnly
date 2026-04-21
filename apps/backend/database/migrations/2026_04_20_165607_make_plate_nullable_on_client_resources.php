<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_resources', function (Blueprint $table) {
            $table->string('plate', 20)->nullable()->change();
            $table->dropUnique('vehicles_tenant_id_plate_unique');
        });
    }

    public function down(): void
    {
        Schema::table('client_resources', function (Blueprint $table) {
            $table->string('plate', 20)->change();
            $table->unique(['tenant_id', 'plate'], 'vehicles_tenant_id_plate_unique');
        });
    }
};
