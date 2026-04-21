<?php

namespace App\Infrastructure\Console\Commands;

use App\Infrastructure\Notifications\Notifications\ReservationReminder;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ReservationReminderModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class SendReservationReminders extends Command
{
    protected $signature = 'reservations:send-reminders';

    protected $description = 'Send push notification reminders for upcoming confirmed reservations';

    public function handle(): int
    {
        $now = Carbon::now();
        $sent = 0;

        $sent += $this->sendDayBeforeReminders($now);
        $sent += $this->sendHoursBeforeReminders($now);

        if ($sent > 0) {
            $this->info("Sent {$sent} reminder(s).");
        }

        return self::SUCCESS;
    }

    private function sendDayBeforeReminders(Carbon $now): int
    {
        if ($now->hour !== 19) {
            return 0;
        }

        $tomorrow = $now->copy()->addDay()->startOfDay();
        $tomorrowEnd = $tomorrow->copy()->endOfDay();

        $reservations = ReservationModel::withoutGlobalScopes()
            ->with(['service', 'client', 'tenant', 'assignedEmployee'])
            ->where('status', 'confirmed')
            ->whereBetween('scheduled_at', [$tomorrow, $tomorrowEnd])
            ->whereDoesntHave('reminders', fn ($q) => $q->where('type', 'day_before'))
            ->get();

        return $this->sendReminders($reservations, 'day_before');
    }

    private function sendHoursBeforeReminders(Carbon $now): int
    {
        $windowStart = $now->copy()->addMinutes(115);
        $windowEnd = $now->copy()->addMinutes(125);

        $reservations = ReservationModel::withoutGlobalScopes()
            ->with(['service', 'client', 'tenant', 'assignedEmployee'])
            ->where('status', 'confirmed')
            ->whereBetween('scheduled_at', [$windowStart, $windowEnd])
            ->whereDoesntHave('reminders', fn ($q) => $q->where('type', 'hours_before'))
            ->get();

        return $this->sendReminders($reservations, 'hours_before');
    }

    private function sendReminders($reservations, string $type): int
    {
        $sent = 0;

        foreach ($reservations as $reservation) {
            try {
                // Notify client
                $client = UserModel::find($reservation->client_id);
                if ($client) {
                    $client->notify(new ReservationReminder($reservation, $type, 'client'));
                }

                // Notify assigned employee
                if ($reservation->assigned_to) {
                    $employee = UserModel::find($reservation->assigned_to);
                    if ($employee) {
                        $employee->notify(new ReservationReminder($reservation, $type, 'employee'));
                    }
                }

                ReservationReminderModel::create([
                    'reservation_id' => $reservation->id,
                    'type' => $type,
                    'sent_at' => now(),
                    'created_at' => now(),
                ]);

                $sent++;
            } catch (\Throwable $e) {
                Log::error('Failed to send reservation reminder', [
                    'reservation_id' => $reservation->id,
                    'type' => $type,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $sent;
    }
}
