<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_variant_consumption', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('service_variant_id');
            $table->uuid('product_id');
            // Amount consumed per unit of service in the product's own unit
            // (e.g. 150 ml of shampoo, 4 L of oil, 1 u of filter).
            $table->decimal('qty', 12, 3);
            $table->timestamps();

            $table->foreign('service_variant_id')
                ->references('id')->on('service_variants')->cascadeOnDelete();
            $table->foreign('product_id')
                ->references('id')->on('products')->cascadeOnDelete();

            // A product can appear at most once per variant; updating
            // the qty is the natural edit path rather than stacking rows.
            $table->unique(['service_variant_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_variant_consumption');
    }
};
