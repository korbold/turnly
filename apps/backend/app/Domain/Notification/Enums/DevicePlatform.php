<?php

namespace App\Domain\Notification\Enums;

enum DevicePlatform: string
{
    case Android = 'android';
    case Ios = 'ios';
    case Web = 'web';
}
