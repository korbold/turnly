<?php

namespace App\Domain\Reservation\Enums;

enum ReservationStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case NoShow = 'no_show';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Pending => in_array($next, [self::Confirmed, self::Cancelled]),
            self::Confirmed => in_array($next, [self::InProgress, self::Cancelled, self::NoShow]),
            self::InProgress => in_array($next, [self::Completed]),
            self::Completed, self::Cancelled, self::NoShow => false,
        };
    }
}
