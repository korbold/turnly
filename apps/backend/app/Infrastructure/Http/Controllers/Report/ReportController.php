<?php

namespace App\Infrastructure\Http\Controllers\Report;

use App\Application\Services\PlanLimitsService;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(private PlanLimitsService $planLimits) {}

    private function ensureFeature(): void
    {
        if (!$this->planLimits->hasFeature(app('current_tenant_id'), 'reports')) {
            abort(response()->json([
                'error' => [
                    'code' => 'PLAN_FEATURE_REQUIRED',
                    'message' => 'Tu plan no incluye reportes. Actualiza para acceder.',
                ],
            ], 403));
        }
    }

    public function daily(Request $request): JsonResponse
    {
        $this->ensureFeature();
        $date = $request->get('date', now()->toDateString());
        $tenantId = app('current_tenant_id');

        $washLogs = ServiceLogModel::where('log_date', $date)->get();
        $reservations = ReservationModel::whereDate('scheduled_at', $date)->with('service')->get();

        $completedReservations = $reservations->whereNotIn('status', ['cancelled', 'no_show']);
        $reservationRevenue = (float) $completedReservations->sum(fn ($r) => $r->service?->price ?? 0);
        $serviceRevenue = (float) $washLogs->sum('price_charged');

        return response()->json([
            'data' => [
                'date' => $date,
                'washes' => [
                    'total' => $washLogs->count() + $completedReservations->count(),
                    'completed' => $washLogs->where('status', 'completed')->count() + $reservations->where('status', 'completed')->count(),
                    'in_progress' => $washLogs->where('status', 'in_progress')->count(),
                    'revenue' => $serviceRevenue + $reservationRevenue,
                    'by_payment_method' => [
                        'cash' => $washLogs->where('payment_method', 'cash')->sum('price_charged'),
                        'card' => $washLogs->where('payment_method', 'card')->sum('price_charged'),
                        'transfer' => $washLogs->where('payment_method', 'transfer')->sum('price_charged'),
                    ],
                ],
                'reservations' => [
                    'total' => $reservations->count(),
                    'pending' => $reservations->where('status', 'pending')->count(),
                    'confirmed' => $reservations->where('status', 'confirmed')->count(),
                    'completed' => $reservations->where('status', 'completed')->count(),
                    'cancelled' => $reservations->where('status', 'cancelled')->count(),
                ],
            ],
            'meta' => [
                'tenant' => app('current_tenant')->slug ?? null,
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }

    public function range(Request $request): JsonResponse
    {
        $this->ensureFeature();
        $request->validate([
            'date_from'      => 'sometimes|date',
            'date_to'        => 'sometimes|date|after_or_equal:date_from',
            // Legacy param names still accepted so older clients keep working.
            'from'           => 'sometimes|date',
            'to'             => 'sometimes|date|after_or_equal:from',
            'payment_method' => 'sometimes|nullable|in:cash,card,transfer',
            'payment_bank'   => 'sometimes|nullable|string|max:40',
        ]);

        $from = $request->get('date_from', $request->get('from', now()->toDateString()));
        $to   = $request->get('date_to',   $request->get('to',   $from));

        $methodFilter = $request->get('payment_method');
        $bankFilter   = $request->get('payment_bank');

        // Legacy wash logs (kept around for tenants migrated from the
        // standalone "registro diario" surface).
        $washLogsQuery = ServiceLogModel::whereBetween('log_date', [$from, $to]);
        if ($methodFilter) {
            $washLogsQuery->where('payment_method', $methodFilter);
        }
        // Wash logs don't carry payment_bank — filtering by bank means
        // we're slicing to transferencia detail, so any non-reservation
        // legacy row drops out of the result by definition.
        if ($bankFilter) {
            $washLogsQuery->whereRaw('1 = 0');
        }
        $washLogs = $washLogsQuery->get();

        // Reservations are the source of truth now. We compute revenue
        // off the persisted items[] (sum of line_total) because the
        // legacy `service.price` doesn't reflect multi-service bookings
        // or per-line overrides captured at check-in.
        $reservationsQuery = ReservationModel::whereBetween('scheduled_at', [
                $from . ' 00:00:00',
                $to . ' 23:59:59',
            ])
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->with(['service', 'items']);

        if ($methodFilter) {
            // Filtering by method only makes sense on rows actually paid
            // with that method; unpaid reservations have NULL columns.
            $reservationsQuery
                ->where('payment_status', 'paid')
                ->where('payment_method', $methodFilter);
        }
        if ($bankFilter) {
            $reservationsQuery->where('payment_bank', $bankFilter);
        }

        $reservations = $reservationsQuery->get();

        // A reservation's total = sum(items.line_total) when items exist,
        // otherwise fall back to the single-service price for legacy rows.
        $totalForReservation = function ($reservation): float {
            if ($reservation->items && $reservation->items->isNotEmpty()) {
                return (float) $reservation->items->sum('line_total');
            }
            return (float) ($reservation->service?->price ?? 0);
        };

        $serviceRevenue     = (float) $washLogs->sum('price_charged');
        $reservationRevenue = (float) $reservations->sum($totalForReservation);
        $totalRevenue       = $serviceRevenue + $reservationRevenue;
        $totalServices      = $washLogs->count() + $reservations->count();

        // The per-method buckets only see rows that carry a method, so a service
        // charged but not collected sat in total_revenue and in no bucket: the
        // donut never added up to the headline. Report both figures instead of
        // making the accountant find the difference.
        $unpaidLogs = $washLogs->where('payment_status', 'unpaid');
        $unpaidRes  = $reservations->where('payment_status', 'unpaid');
        $unpaidRevenue = (float) $unpaidLogs->sum('price_charged')
            + (float) $unpaidRes->sum($totalForReservation);
        $collectedRevenue = $totalRevenue - $unpaidRevenue;

        // Per-method buckets (Phase 1 payments live on the reservation
        // row; the older wash logs still carry their own payment_method).
        $paidReservations = $reservations->where('payment_status', 'paid');
        $methodTotal = function (string $method) use ($washLogs, $paidReservations, $totalForReservation): array {
            $logs = $washLogs->where('payment_method', $method);
            $res  = $paidReservations->where('payment_method', $method);
            return [
                'count' => $logs->count() + $res->count(),
                'total' => (float) $logs->sum('price_charged') + (float) $res->sum($totalForReservation),
            ];
        };
        $byPaymentMethod = [
            'cash'     => $methodTotal('cash'),
            'card'     => $methodTotal('card'),
            'transfer' => $methodTotal('transfer'),
        ];

        // Bank-level breakdown for the transfer slice. Only computed off
        // reservations because wash logs don't track bank. Grouped on
        // the slug so the UI can decorate each entry with the bank's
        // brand chip / logo from its own constants table.
        $transferReservations = $paidReservations
            ->where('payment_method', 'transfer')
            ->whereNotNull('payment_bank');
        $byBank = [];
        foreach ($transferReservations->groupBy('payment_bank') as $slug => $rows) {
            $byBank[$slug] = [
                'count' => $rows->count(),
                'total' => (float) $rows->sum($totalForReservation),
            ];
        }

        // Daily breakdown over every date in the range, even days with
        // zero activity, so the chart's x-axis stays continuous.
        $dailyBreakdown = [];
        $current = new \DateTime($from);
        $end     = new \DateTime($to);
        $activeDays = 0;
        while ($current <= $end) {
            $dayStr  = $current->format('Y-m-d');
            // log_date is cast to a date, so the model hands back a Carbon whose
            // string form carries a time. Comparing it against a plain Y-m-d never
            // matched, and every day came back empty under headline totals that were
            // right. Same normalisation monthly() already uses.
            $dayLogs = $washLogs->filter(
                fn ($l) => $l->log_date?->format('Y-m-d') === $dayStr
            );
            $dayRes  = $reservations->filter(fn ($r) => str_starts_with((string) $r->scheduled_at, $dayStr));
            $dayResPaid = $dayRes->where('payment_status', 'paid');

            $dayServiceRev = (float) $dayLogs->sum('price_charged');
            $dayResRev     = (float) $dayRes->sum($totalForReservation);
            $dayRevenue    = $dayServiceRev + $dayResRev;

            if ($dayRevenue > 0 || $dayLogs->count() + $dayRes->count() > 0) {
                $activeDays++;
            }

            $dayUnpaid = (float) $dayLogs->where('payment_status', 'unpaid')->sum('price_charged')
                + (float) $dayRes->where('payment_status', 'unpaid')->sum($totalForReservation);

            $dailyBreakdown[] = [
                'date'         => $dayStr,
                'services'     => $dayLogs->count() + $dayRes->count(),
                'reservations' => $dayRes->count(),
                'revenue'      => $dayRevenue,
                'collected'    => $dayRevenue - $dayUnpaid,
                'unpaid'       => $dayUnpaid,
                'by_cash'      => (float) $dayLogs->where('payment_method', 'cash')->sum('price_charged')
                    + (float) $dayResPaid->where('payment_method', 'cash')->sum($totalForReservation),
                'by_card'      => (float) $dayLogs->where('payment_method', 'card')->sum('price_charged')
                    + (float) $dayResPaid->where('payment_method', 'card')->sum($totalForReservation),
                'by_transfer'  => (float) $dayLogs->where('payment_method', 'transfer')->sum('price_charged')
                    + (float) $dayResPaid->where('payment_method', 'transfer')->sum($totalForReservation),
            ];
            $current->modify('+1 day');
        }

        // Averages what was actually taken, so it agrees with the headline
        // rather than quoting a per-day figure the till never saw.
        $averageDailyRevenue = $activeDays > 0 ? $collectedRevenue / $activeDays : 0.0;

        return response()->json([
            'data' => [
                'from' => $from,
                'to'   => $to,
                // Nested `stats` block matches the admin mapper contract.
                'stats' => [
                    'total_services'        => $totalServices,
                    // Everything registered in the range, collected or not.
                    'total_revenue'         => $totalRevenue,
                    'collected_revenue'     => $collectedRevenue,
                    'unpaid_revenue'        => $unpaidRevenue,
                    'unpaid_count'          => $unpaidLogs->count() + $unpaidRes->count(),
                    'total_reservations'    => $reservations->count(),
                    'average_daily_revenue' => round($averageDailyRevenue, 2),
                ],
                'daily_breakdown'   => $dailyBreakdown,
                'by_payment_method' => $byPaymentMethod,
                'by_bank'           => $byBank,
                'filters' => [
                    'payment_method' => $methodFilter,
                    'payment_bank'   => $bankFilter,
                ],
            ],
            'meta' => [
                'tenant'    => app('current_tenant')->slug ?? null,
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }

    public function weekly(Request $request): JsonResponse
    {
        $this->ensureFeature();
        $week = $request->get('week', now()->format('Y-\\WW'));
        // Parse week to get start/end dates
        $startOfWeek = new \DateTime();
        $startOfWeek->setISODate((int) substr($week, 0, 4), (int) substr($week, 6));
        $endOfWeek = clone $startOfWeek;
        $endOfWeek->modify('+6 days');

        $washLogs = ServiceLogModel::whereBetween('log_date', [
            $startOfWeek->format('Y-m-d'),
            $endOfWeek->format('Y-m-d'),
        ])->get();

        $reservations = ReservationModel::whereBetween('scheduled_at', [
            $startOfWeek->format('Y-m-d') . ' 00:00:00',
            $endOfWeek->format('Y-m-d') . ' 23:59:59',
        ])->whereNotIn('status', ['cancelled', 'no_show'])->with('service')->get();

        $dailyBreakdown = [];
        for ($i = 0; $i < 7; $i++) {
            $day = clone $startOfWeek;
            $day->modify("+{$i} days");
            $dayStr = $day->format('Y-m-d');
            // log_date is cast to a date, so the model hands back a Carbon whose
            // string form carries a time. Comparing it against a plain Y-m-d never
            // matched, and every day came back empty under headline totals that were
            // right. Same normalisation monthly() already uses.
            $dayLogs = $washLogs->filter(
                fn ($l) => $l->log_date?->format('Y-m-d') === $dayStr
            );
            $dayRes = $reservations->filter(fn ($r) => str_starts_with($r->scheduled_at, $dayStr));
            $dailyBreakdown[$dayStr] = [
                'washes' => $dayLogs->count() + $dayRes->count(),
                'revenue' => (float) $dayLogs->sum('price_charged') + (float) $dayRes->sum(fn ($r) => $r->service?->price ?? 0),
            ];
        }

        $reservationRevenue = (float) $reservations->sum(fn ($r) => $r->service?->price ?? 0);

        return response()->json([
            'data' => [
                'week' => $week,
                'total_washes' => $washLogs->count() + $reservations->count(),
                'total_revenue' => (float) $washLogs->sum('price_charged') + $reservationRevenue,
                'daily' => $dailyBreakdown,
            ],
            'meta' => [
                'tenant' => app('current_tenant')->slug ?? null,
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }

    public function monthly(Request $request): JsonResponse
    {
        $this->ensureFeature();
        $month = $request->get('month', now()->format('Y-m'));
        $year = (int) substr($month, 0, 4);
        $mon = (int) substr($month, 5, 2);

        $startDate = "{$month}-01";
        $endDate = date('Y-m-t', mktime(0, 0, 0, $mon, 1, $year));

        $washLogs = ServiceLogModel::whereBetween('log_date', [$startDate, $endDate])->get();

        $reservations = ReservationModel::whereBetween('scheduled_at', [
            $startDate . ' 00:00:00',
            $endDate . ' 23:59:59',
        ])->whereNotIn('status', ['cancelled', 'no_show'])->with('service')->get();

        $reservationRevenue = (float) $reservations->sum(fn ($r) => $r->service?->price ?? 0);
        $totalCount = $washLogs->count() + $reservations->count();
        $totalRevenue = (float) $washLogs->sum('price_charged') + $reservationRevenue;

        $activeDays = $washLogs->groupBy(fn($l) => $l->log_date->format('Y-m-d'))->count();
        $resDays = $reservations->groupBy(fn($r) => substr($r->scheduled_at, 0, 10))->count();
        $uniqueDays = max($activeDays, $resDays, 1);

        return response()->json([
            'data' => [
                'month' => $month,
                'total_washes' => $totalCount,
                'total_revenue' => $totalRevenue,
                'by_payment_method' => [
                    'cash' => (float) $washLogs->where('payment_method', 'cash')->sum('price_charged'),
                    'card' => (float) $washLogs->where('payment_method', 'card')->sum('price_charged'),
                    'transfer' => (float) $washLogs->where('payment_method', 'transfer')->sum('price_charged'),
                ],
                'average_daily_washes' => $totalCount > 0
                    ? round($totalCount / $uniqueDays, 1)
                    : 0,
            ],
            'meta' => [
                'tenant' => app('current_tenant')->slug ?? null,
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }
}
