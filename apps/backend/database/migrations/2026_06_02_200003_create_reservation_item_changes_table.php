<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Append-only audit log for reservation item edits. Every mutation
     * (add/remove/upgrade/downgrade/price_override) is captured so
     * managers can review counter activity per shift.
     */
    public function up(): void
    {
        Schema::create('reservation_item_changes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('reservation_id');
            $table->enum('action', [
                'added', 'removed', 'upgraded', 'downgraded', 'price_override',
            ]);
            // Captured for searchability; reservation_items themselves
            // may be deleted, but the audit row keeps the label/price.
            $table->string('item_type', 30)->nullable();
            $table->uuid('old_ref_id')->nullable();
            $table->uuid('new_ref_id')->nullable();
            $table->string('label', 160)->nullable();
            $table->decimal('old_price', 12, 2)->nullable();
            $table->decimal('new_price', 12, 2)->nullable();
            $table->text('reason')->nullable();
            $table->uuid('changed_by_user_id')->nullable();
            $table->timestamp('changed_at')->useCurrent();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('reservation_id')->references('id')->on('reservations')->cascadeOnDelete();
            $table->foreign('changed_by_user_id')->references('id')->on('users')->nullOnDelete();

            $table->index(['reservation_id', 'changed_at']);
            $table->index(['tenant_id', 'changed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservation_item_changes');
    }
};
