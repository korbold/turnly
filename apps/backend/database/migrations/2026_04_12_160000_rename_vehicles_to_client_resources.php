<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop foreign keys first
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropForeign(['vehicle_id']);
        });

        Schema::table('wash_logs', function (Blueprint $table) {
            $table->dropForeign(['vehicle_id']);
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropForeign(['owner_id']);
        });

        // Rename table
        Schema::rename('vehicles', 'client_resources');

        // Add new columns, rename owner_id
        Schema::table('client_resources', function (Blueprint $table) {
            $table->renameColumn('owner_id', 'client_id');
        });

        Schema::table('client_resources', function (Blueprint $table) {
            $table->string('label', 255)->nullable()->after('client_id');
            $table->json('data')->nullable()->after('label');
            $table->foreign('client_id')->references('id')->on('users')->cascadeOnDelete();
            // Drop the old FK name inherited from the vehicles table rename, then re-add
            $table->dropForeign('vehicles_tenant_id_foreign');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });

        // Rename vehicle_id in reservations and make nullable for SET NULL FK
        Schema::table('reservations', function (Blueprint $table) {
            $table->renameColumn('vehicle_id', 'client_resource_id');
        });

        Schema::table('reservations', function (Blueprint $table) {
            $table->uuid('client_resource_id')->nullable()->change();
            $table->foreign('client_resource_id')->references('id')->on('client_resources')->nullOnDelete();
        });

        // Rename vehicle_id in wash_logs and make nullable for SET NULL FK
        Schema::table('wash_logs', function (Blueprint $table) {
            $table->renameColumn('vehicle_id', 'client_resource_id');
        });

        Schema::table('wash_logs', function (Blueprint $table) {
            $table->uuid('client_resource_id')->nullable()->change();
            $table->foreign('client_resource_id')->references('id')->on('client_resources')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('wash_logs', function (Blueprint $table) {
            $table->dropForeign(['client_resource_id']);
            $table->renameColumn('client_resource_id', 'vehicle_id');
        });

        Schema::table('reservations', function (Blueprint $table) {
            $table->dropForeign(['client_resource_id']);
            $table->renameColumn('client_resource_id', 'vehicle_id');
        });

        Schema::table('client_resources', function (Blueprint $table) {
            $table->dropForeign(['client_id']);
            $table->dropForeign(['tenant_id']);
            $table->dropColumn(['label', 'data']);
            $table->renameColumn('client_id', 'owner_id');
        });

        Schema::rename('client_resources', 'vehicles');

        Schema::table('vehicles', function (Blueprint $table) {
            $table->foreign('owner_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });

        Schema::table('reservations', function (Blueprint $table) {
            $table->foreign('vehicle_id')->references('id')->on('vehicles')->nullOnDelete();
        });

        Schema::table('wash_logs', function (Blueprint $table) {
            $table->foreign('vehicle_id')->references('id')->on('vehicles')->nullOnDelete();
        });
    }
};
