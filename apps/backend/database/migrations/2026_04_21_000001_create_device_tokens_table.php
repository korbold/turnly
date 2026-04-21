<?php
// database/migrations/2026_04_21_000001_create_device_tokens_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('device_tokens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable()->index();
            $table->uuid('tenant_id')->index();
            $table->enum('platform', ['android', 'ios', 'web']);
            $table->string('token', 512)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['user_id', 'platform']);

            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_tokens');
    }
};
