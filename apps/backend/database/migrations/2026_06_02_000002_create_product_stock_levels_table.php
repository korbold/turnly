<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_stock_levels', function (Blueprint $table) {
            $table->uuid('product_id')->primary();
            $table->decimal('on_hand', 12, 3)->default(0);
            $table->decimal('reserved', 12, 3)->default(0);
            // running weighted-average cost; recomputed on each purchase
            $table->decimal('avg_cost', 12, 4)->default(0);
            $table->timestamp('updated_at')->nullable();

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_stock_levels');
    }
};
