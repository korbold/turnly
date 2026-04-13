<?php

namespace App\Infrastructure\Http\Controllers\Report;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function daily(Request $request): JsonResponse
    {
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
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $from = $request->get('from');
        $to = $request->get('to');
        $tenantId = app('current_tenant_id');

        $washLogs = ServiceLogModel::whereBetween('log_date', [$from, $to])->get();
        $reservations = ReservationModel::whereBetween('scheduled_at', [
            $from . ' 00:00:00',
            $to . ' 23:59:59',
        ])->with('service')->get();

        $completedReservations = $reservations->whereNotIn('status', ['cancelled', 'no_show']);
        $serviceRevenue = (float) $washLogs->sum('price_charged');
        $reservationRevenue = (float) $completedReservations->sum(fn ($r) => $r->service?->price ?? 0);

        // Daily breakdown
        $dailyBreakdown = [];
        $current = new \DateTime($from);
        $end = new \DateTime($to);
        while ($current <= $end) {
            $dayStr = $current->format('Y-m-d');
            $dayLogs = $washLogs->where('log_date', $dayStr);
            $dayRes = $completedReservations->filter(fn ($r) => str_starts_with($r->scheduled_at, $dayStr));
            $dayServiceRev = (float) $dayLogs->sum('price_charged');
            $dayResRev = (float) $dayRes->sum(fn ($r) => $r->service?->price ?? 0);
            $dailyBreakdown[] = [
                'date' => $dayStr,
                'services' => $dayLogs->count(),
                'reservations' => $dayRes->count(),
                'revenue' => $dayServiceRev + $dayResRev,
            ];
            $current->modify('+1 day');
        }

        return response()->json([
            'data' => [
                'from' => $from,
                'to' => $to,
                'total_services' => $washLogs->count() + $completedReservations->count(),
                'total_revenue' => $serviceRevenue + $reservationRevenue,
                'services_count' => $washLogs->count(),
                'reservations_count' => $completedReservations->count(),
                'reservations_total' => $reservations->count(),
                'reservations_cancelled' => $reservations->where('status', 'cancelled')->count(),
                'by_payment_method' => [
                    'cash' => (float) $washLogs->where('payment_method', 'cash')->sum('price_charged'),
                    'card' => (float) $washLogs->where('payment_method', 'card')->sum('price_charged'),
                    'transfer' => (float) $washLogs->where('payment_method', 'transfer')->sum('price_charged'),
                ],
                'daily' => $dailyBreakdown,
            ],
            'meta' => [
                'tenant' => app('current_tenant')->slug ?? null,
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }

    public function weekly(Request $request): JsonResponse
    {
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
            $dayLogs = $washLogs->where('log_date', $dayStr);
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
