<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A counter sale is registered unattached: the walk-in who only wants
 * the aceite has no vehicle on file and wants no invoice. MySQL already
 * allows NULL here — the 2026_04_12 rename loosened it — but that block
 * sat behind a !isSqlite() guard, so SQLite (tests) still refuses.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('service_logs', function ($table) {
                $table->char('client_resource_id', 36)->nullable()->change();
            });

            return;
        }

        // Raw MODIFY keeps the client_resource_id foreign key in place.
        DB::statement('ALTER TABLE service_logs MODIFY client_resource_id CHAR(36) NULL');
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('service_logs', function ($table) {
                $table->char('client_resource_id', 36)->nullable(false)->change();
            });

            return;
        }

        DB::statement('ALTER TABLE service_logs MODIFY client_resource_id CHAR(36) NOT NULL');
    }
};
