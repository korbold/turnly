<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('sku', 60)->nullable();
            $table->string('name');
            $table->text('description')->nullable();
            // consumable: only used internally by services
            // sellable:   only sold loose at counter
            // both:       used in services AND sold loose
            $table->enum('type', ['consumable', 'sellable', 'both'])->default('both');
            // ml / L / g / kg / u(nit)
            $table->enum('unit', ['ml', 'L', 'g', 'kg', 'u'])->default('u');
            $table->decimal('cost', 12, 4)->default(0);
            $table->decimal('price', 12, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(15.00);
            $table->decimal('stock_min', 12, 3)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->unique(['tenant_id', 'sku']);
            $table->index(['tenant_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
