<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Backfill: for every existing reservation that has no items yet,
     * synthesize a single `service_variant` line from its (service_id,
     * service_variant_id, service.price) tuple. Keeps historical bills
     * coherent with the new polymorphic model.
     */
    public function up(): void
    {
        $reservations = DB::table('reservations')
            ->whereNull('deleted_at')
            ->select(['id', 'tenant_id', 'service_id', 'service_variant_id'])
            ->get();

        foreach ($reservations as $r) {
            $hasItems = DB::table('reservation_items')->where('reservation_id', $r->id)->exists();
            if ($hasItems) continue;

            $variantId = $r->service_variant_id;
            $price = 0;
            $label = 'Servicio';

            if ($variantId) {
                $variant = DB::table('service_variants')->where('id', $variantId)->first();
                if ($variant) {
                    $price = (float) $variant->price;
                    $service = DB::table('services')->where('id', $r->service_id)->first();
                    $label = ($service?->name ?? 'Servicio') . ' · ' . $variant->label;
                }
            }

            if (!$variantId) {
                // Fall back to the service's "Default" variant from the previous backfill.
                $defaultVariant = DB::table('service_variants')
                    ->where('service_id', $r->service_id)
                    ->where('label', 'Default')
                    ->first();
                if ($defaultVariant) {
                    $variantId = $defaultVariant->id;
                    $price = (float) $defaultVariant->price;
                    $service = DB::table('services')->where('id', $r->service_id)->first();
                    $label = $service?->name ?? 'Servicio';
                }
            }

            if (!$variantId) continue; // service may have no variants — skip

            DB::table('reservation_items')->insert([
                'id'             => (string) Str::uuid(),
                'tenant_id'      => $r->tenant_id,
                'reservation_id' => $r->id,
                'item_type'      => 'service_variant',
                'ref_id'         => $variantId,
                'label'          => $label,
                'qty'            => 1,
                'unit_price'     => $price,
                'line_total'     => $price,
                'sort_order'     => 0,
                'created_at'     => now(),
                'updated_at'     => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Reversible: clearing the synthesized items is safe — the
        // reservation still carries service_id + service_variant_id.
        DB::table('reservation_items')->truncate();
    }
};
