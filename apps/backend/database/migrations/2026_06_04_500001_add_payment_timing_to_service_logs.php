<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Payment runs on a separate track from the lifecycle status:
        // a car-wash service can be `completed` but `payment_status =
        // unpaid` because the customer pays at pickup. The columns are
        // optional so legacy rows stay valid — backfill flips existing
        // rows to `paid` since the pre-Fase-B form always charged at
        // registration time.
        Schema::table('service_logs', function (Blueprint $table) {
            $table->enum('payment_status', ['unpaid', 'paid'])
                ->default('paid')
                ->after('payment_bank');
            $table->timestamp('paid_at')->nullable()->after('payment_status');
        });

        // Existing rows = paid (price_charged was always captured at
        // registration). Stamp paid_at with started_at as a best-effort
        // anchor so reports filtering on paid_at still group them by
        // the right day.
        DB::table('service_logs')->update([
            'payment_status' => 'paid',
            'paid_at'        => DB::raw('started_at'),
        ]);

        // Now that history is backfilled, we can relax payment_method to
        // nullable so "cobrar al retirar" flows can leave it empty until
        // the cashier records the actual payment later.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE service_logs MODIFY COLUMN payment_method ENUM('cash','card','transfer','other') NULL");
        } else {
            // SQLite stores the enum as TEXT but kept the NOT NULL from the
            // create migration, so tests could not insert the very rows
            // production allows. Relax it explicitly to keep the test schema
            // honest about "cobrar al retirar".
            Schema::table('service_logs', function (Blueprint $table) {
                $table->string('payment_method')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE service_logs MODIFY COLUMN payment_method ENUM('cash','card','transfer','other') NOT NULL DEFAULT 'cash'");
        }
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropColumn(['payment_status', 'paid_at']);
        });
    }
};
