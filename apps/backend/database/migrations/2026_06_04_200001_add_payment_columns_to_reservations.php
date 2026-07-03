<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // Tracks pago independent of lifecycle status. A reservation
            // can be `completed` but still `unpaid` (typical car-wash
            // pickup flow), or already paid before service starts (spa
            // prepay).
            $table->enum('payment_status', ['unpaid', 'paid'])
                ->default('unpaid')
                ->after('billing_snapshot');
            $table->enum('payment_method', ['transfer', 'card', 'cash'])
                ->nullable()
                ->after('payment_status');
            $table->timestamp('paid_at')->nullable()->after('payment_method');
            $table->string('payment_reference', 100)
                ->nullable()
                ->after('paid_at');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn([
                'payment_status',
                'payment_method',
                'paid_at',
                'payment_reference',
            ]);
        });
    }
};
