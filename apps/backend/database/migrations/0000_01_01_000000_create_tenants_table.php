<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 100)->unique();
            $table->string('name');
            $table->string('owner_name');
            $table->string('email')->unique();
            $table->string('phone', 20)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('country', 2)->default('EC');
            $table->enum('plan', ['trial', 'basic', 'pro'])->default('trial');
            $table->enum('status', ['pending', 'active', 'suspended', 'cancelled'])->default('pending');
            $table->timestamp('trial_ends_at')->nullable();
            $table->json('settings')->nullable();
            $table->tinyInteger('onboarding_step')->default(0);
            $table->timestamp('activated_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
