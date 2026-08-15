<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A counter sale can be products only — an aceite sold without washing
 * anything. The log's "primary service" is a legacy convenience column
 * for reports that group by service; it cannot be required when no
 * service was rendered.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('service_logs', function ($table) {
                $table->char('service_id', 36)->nullable()->change();
            });

            return;
        }

        // Raw MODIFY keeps wash_logs_service_id_foreign in place.
        DB::statement('ALTER TABLE service_logs MODIFY service_id CHAR(36) NULL');
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('service_logs', function ($table) {
                $table->char('service_id', 36)->nullable(false)->change();
            });

            return;
        }

        DB::statement('ALTER TABLE service_logs MODIFY service_id CHAR(36) NOT NULL');
    }
};
