<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL: extend the enum with `checked_in`. SQLite (tests): ALTER
        // TABLE can't modify an enum, but SQLite stores enums as TEXT so
        // the new value works without a schema change.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE reservations MODIFY COLUMN status ENUM('pending','confirmed','checked_in','in_progress','completed','cancelled','no_show') NOT NULL DEFAULT 'pending'");
        }

        Schema::table('reservations', function (Blueprint $table) {
            // Timestamp the customer was checked in at the counter.
            // Drives stock-reservation logic and the audit timeline.
            $table->timestamp('checked_in_at')->nullable();
            // Snapshot of the billing profile in effect when the customer
            // was checked in. Frozen so later profile edits do not change
            // historical reservations or the eventual SRI invoice.
            $table->json('billing_snapshot')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn(['checked_in_at', 'billing_snapshot']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE reservations MODIFY COLUMN status ENUM('pending','confirmed','in_progress','completed','cancelled','no_show') NOT NULL DEFAULT 'pending'");
        }
    }
};
