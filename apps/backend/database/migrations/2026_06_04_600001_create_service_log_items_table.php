<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Polymorphic line items per service_log, mirroring
     * `reservation_items`. Lets the cashier register multiple servicios
     * (lavada + pulido + aspirado) on a single log row instead of
     * forcing three separate records.
     *
     * `price_charged` on the parent stays as the sum of `line_total` so
     * reports and the daily summary remain back-compat without touching
     * their math. The items table carries the breakdown.
     */
    public function up(): void
    {
        Schema::create('service_log_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('service_log_id');
            // Future-proof for product items the same way reservation_items
            // does. Fase C only ships service_variant; product support is
            // separate scope.
            $table->string('item_type', 30)->default('service_variant');
            $table->uuid('ref_id');
            $table->string('label', 160);
            $table->decimal('qty', 10, 2)->default(1);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('line_total', 12, 2);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('service_log_id')->references('id')->on('service_logs')->cascadeOnDelete();
            $table->index(['service_log_id', 'sort_order']);
        });

        // Backfill: each existing service_log gets one item that mirrors
        // its single service + price_charged so the new schema is
        // immediately consistent across all reads.
        $logs = DB::table('service_logs')
            ->select('id', 'tenant_id', 'service_id', 'price_charged')
            ->whereNotNull('service_id')
            ->get();

        $rows = [];
        $now = now();
        foreach ($logs as $log) {
            $rows[] = [
                'id'             => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id'      => $log->tenant_id,
                'service_log_id' => $log->id,
                'item_type'      => 'service_variant',
                'ref_id'         => $log->service_id,
                'label'          => 'Servicio',
                'qty'            => 1,
                'unit_price'     => (float) $log->price_charged,
                'line_total'     => (float) $log->price_charged,
                'sort_order'     => 0,
                'created_at'     => $now,
                'updated_at'     => $now,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('service_log_items')->insert($chunk);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('service_log_items');
    }
};
