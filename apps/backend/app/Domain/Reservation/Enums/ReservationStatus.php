<?php

namespace App\Domain\Reservation\Enums;

enum ReservationStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case CheckedIn = 'checked_in';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case NoShow = 'no_show';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            // Customer has booked; everything from here is downstream.
            // CheckedIn is allowed directly so the dashboard's one-click
            // "Confirmar llegada" can collapse confirm + check-in into a
            // single staff action when the customer walks in unannounced.
            self::Pending     => in_array($next, [self::Confirmed, self::CheckedIn, self::Cancelled]),
            // Confirmed by staff; can skip to in_progress for legacy flows
            // or go through the new check_in step for the counter.
            self::Confirmed   => in_array($next, [self::CheckedIn, self::InProgress, self::Cancelled, self::NoShow]),
            // Counter has the customer + vehicle in front of them.
            // Items can still be edited; cancellation refunds reserved
            // stock via ConsumptionEngine::release.
            self::CheckedIn   => in_array($next, [self::InProgress, self::Cancelled]),
            // Service is being performed; only `complete` is allowed.
            self::InProgress  => in_array($next, [self::Completed]),
            // Terminal states.
            self::Completed, self::Cancelled, self::NoShow => false,
        };
    }
}
