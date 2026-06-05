<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // Stores the bank slug when payment_method = 'transfer'. Kept
            // free-form (slug, not enum) so a tenant can add a regional
            // bank later without us shipping a migration.
            $table->string('payment_bank', 40)
                ->nullable()
                ->after('payment_reference');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn('payment_bank');
        });
    }
};
