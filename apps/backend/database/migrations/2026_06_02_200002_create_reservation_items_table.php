<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reservation lines: a reservation now holds N items (services or
     * loose products) instead of being tied to a single service_id.
     */
    public function up(): void
    {
        Schema::create('reservation_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('reservation_id');
            // service_variant: ref_id points to service_variants.id
            // product:        ref_id points to products.id (loose sale)
            $table->enum('item_type', ['service_variant', 'product']);
            $table->uuid('ref_id');
            // Snapshot of the label/name at the moment of sale so renames
            // and deletions never alter past bills.
            $table->string('label', 160);
            $table->decimal('qty', 12, 3)->default(1);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('line_total', 12, 2);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('reservation_id')->references('id')->on('reservations')->cascadeOnDelete();
            $table->index(['reservation_id', 'sort_order']);
            $table->index(['item_type', 'ref_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservation_items');
    }
};
