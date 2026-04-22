<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->decimal('price', 8, 2)->default(0);
            $table->unsignedInteger('max_services')->nullable();
            $table->unsignedInteger('max_reservations_per_month')->nullable();
            $table->unsignedInteger('max_employees')->nullable();
            $table->boolean('has_push_notifications')->default(false);
            $table->boolean('has_reports')->default(false);
            $table->boolean('has_reminders')->default(false);
            $table->boolean('has_custom_page')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
