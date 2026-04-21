<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservation_reminders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reservation_id');
            $table->enum('type', ['day_before', 'hours_before']);
            $table->timestamp('sent_at');
            $table->timestamp('created_at')->nullable();

            $table->unique(['reservation_id', 'type']);
            $table->foreign('reservation_id')
                ->references('id')
                ->on('reservations')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservation_reminders');
    }
};
