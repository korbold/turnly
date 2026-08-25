<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Le devuelve su arqueo a las cajas que se cerraron antes de que existiera la
 * tabla que los guarda.
 *
 * `cash_session_closures` nació el 2026-08-25 y la caja del 24 de agosto ya
 * estaba cerrada: contó $464 contra $514 esperados, un faltante de $50. Los
 * tres números están en `cash_sessions`, pero la pantalla del detalle dibuja
 * la sección "Arqueo" desde `closures` — con la lista vacía no muestra nada,
 * y el faltante sólo se lee con SQL. Justo lo que la pantalla vino a evitar.
 *
 * `closeSession()` hoy escribe las dos cosas en la misma transacción, así que
 * esto no vuelve a pasar: es una reparación de una vez.
 *
 * `created_at` queda NULL a propósito, y es la marca de que la fila se
 * reconstruyó después en vez de escribirse cuando alguien cerró el cajón.
 * `counted_breakdown` también: esos cierres no pedían el desglose todavía, y
 * un desglose inventado sería peor que ninguno.
 */
return new class extends Migration
{
    public function up(): void
    {
        $huerfanas = DB::table('cash_sessions')
            ->whereNotNull('closed_at')
            ->whereNotNull('counted_amount')
            ->whereNotExists(fn ($q) => $q
                ->selectRaw('1')
                ->from('cash_session_closures')
                ->whereColumn('cash_session_closures.cash_session_id', 'cash_sessions.id'))
            ->get(['id', 'tenant_id', 'counted_amount', 'expected_amount', 'difference', 'closed_by', 'closed_at', 'notes']);

        foreach ($huerfanas as $s) {
            DB::table('cash_session_closures')->insert([
                'id'                => (string) Str::orderedUuid(),
                'tenant_id'         => $s->tenant_id,
                'cash_session_id'   => $s->id,
                'counted_amount'    => $s->counted_amount,
                'counted_breakdown' => null,
                'expected_amount'   => $s->expected_amount,
                'difference'        => $s->difference,
                'closed_by'         => $s->closed_by,
                'closed_at'         => $s->closed_at,
                'notes'             => $s->notes,
                'created_at'        => null,
                'updated_at'        => null,
            ]);
        }
    }

    /**
     * Sólo las que esta migración escribió: `created_at` NULL es la marca. Un
     * arqueo firmado por el cajero no se toca.
     */
    public function down(): void
    {
        DB::table('cash_session_closures')->whereNull('created_at')->delete();
    }
};
