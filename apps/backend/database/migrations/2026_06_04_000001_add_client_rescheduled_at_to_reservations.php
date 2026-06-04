<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tracks when a customer used the in-app reschedule endpoint. The
 * customer is capped to one reschedule per booking; staff reschedules
 * stay unlimited and don't touch this column.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->timestamp('client_rescheduled_at')->nullable()->after('cancelled_at');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn('client_rescheduled_at');
        });
    }
};
