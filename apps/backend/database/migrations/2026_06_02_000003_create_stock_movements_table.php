<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('product_id');
            // purchase:    + qty, raises stock and avg_cost
            // sale:        - qty, point-of-sale of loose product
            // consumption: - qty, service used the product (via BOM)
            // adjustment:  +/- qty, manual correction
            // return:      + qty, customer returned a sold product
            $table->enum('type', ['purchase', 'sale', 'consumption', 'adjustment', 'return']);
            // signed: positive = stock in, negative = stock out
            $table->decimal('qty', 12, 3);
            $table->decimal('unit_cost', 12, 4)->default(0);
            // polymorphic ref to source: reservation, purchase_order, manual
            $table->string('ref_type', 40)->nullable();
            $table->uuid('ref_id')->nullable();
            $table->uuid('user_id')->nullable();
            $table->text('note')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();

            $table->index(['tenant_id', 'product_id', 'created_at']);
            $table->index(['ref_type', 'ref_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
