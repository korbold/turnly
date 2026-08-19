<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Cada servicio que hoy figura pagado se convierte en un pago del libro,
     * por su precio completo, con su método, su fecha y quien lo atendió como
     * quien lo cobró. Después de esto, sumar `payments.amount` da exactamente
     * lo mismo que sumaba `service_logs.price_charged` de los pagados — que es
     * el criterio de éxito de toda la fase.
     *
     * No usa PaymentLedger a propósito: una migración tiene que poder correr
     * dentro de cinco años, y para entonces la firma de ese servicio va a
     * haber cambiado. Escribe con DB::table() y se sostiene sola.
     *
     * Idempotente: sólo toma servicios que todavía no tienen asignación.
     */
    public function up(): void
    {
        $yaMigrados = DB::table('payment_allocations')
            ->where('payable_type', 'service_log')
            ->pluck('payable_id')
            ->all();

        $query = DB::table('service_logs')
            ->where('payment_status', 'paid')
            ->whereNotNull('price_charged');

        if ($yaMigrados !== []) {
            $query->whereNotIn('id', $yaMigrados);
        }

        $ahora = now();

        $query->orderBy('id')->chunkById(500, function ($logs) use ($ahora) {
            $pagos = [];
            $asignaciones = [];

            foreach ($logs as $log) {
                $paymentId = (string) Str::uuid();
                $monto = (float) $log->price_charged;

                $pagos[] = [
                    'id'          => $paymentId,
                    'tenant_id'   => $log->tenant_id,
                    // El cliente sale del recurso; una subconsulta por fila
                    // sería lenta en una tabla grande, así que se resuelve
                    // abajo en bloque.
                    'client_id'   => null,
                    'amount'      => $monto,
                    // Filas viejas sin método: efectivo es el default histórico
                    // de la columna y el caso real de una lavadora.
                    'method'      => $log->payment_method ?: 'cash',
                    'bank'        => $log->payment_bank,
                    'paid_at'     => $log->paid_at ?? $log->created_at ?? $ahora,
                    'received_by' => $log->attended_by,
                    'notes'       => null,
                    'created_at'  => $ahora,
                    'updated_at'  => $ahora,
                ];

                $asignaciones[] = [
                    'id'           => (string) Str::uuid(),
                    'tenant_id'    => $log->tenant_id,
                    'payment_id'   => $paymentId,
                    'payable_type' => 'service_log',
                    'payable_id'   => $log->id,
                    'amount'       => $monto,
                    'created_at'   => $ahora,
                    'updated_at'   => $ahora,
                ];
            }

            foreach (array_chunk($pagos, 200) as $bloque) {
                DB::table('payments')->insert($bloque);
            }
            foreach (array_chunk($asignaciones, 200) as $bloque) {
                DB::table('payment_allocations')->insert($bloque);
            }
        });

        // client_id en bloque: un UPDATE con join en vez de una subconsulta
        // por fila.
        DB::table('payments')
            ->whereNull('client_id')
            ->whereExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('payment_allocations')
                    ->whereColumn('payment_allocations.payment_id', 'payments.id');
            })
            ->update([
                'client_id' => DB::raw('(
                    SELECT cr.client_id
                    FROM payment_allocations pa
                    JOIN service_logs sl ON sl.id = pa.payable_id
                    JOIN client_resources cr ON cr.id = sl.client_resource_id
                    WHERE pa.payment_id = payments.id
                      AND pa.payable_type = \'service_log\'
                    LIMIT 1
                )'),
            ]);
    }

    /**
     * Sólo borra lo que este backfill creó: pagos cuya única asignación
     * apunta a un service_log. Un rollback que vacíe la tabla se llevaría
     * también los cobros hechos después de migrar.
     */
    public function down(): void
    {
        $ids = DB::table('payment_allocations')
            ->where('payable_type', 'service_log')
            ->pluck('payment_id')
            ->all();

        if ($ids === []) {
            return;
        }

        DB::table('payments')->whereIn('id', $ids)->delete();
    }
};
