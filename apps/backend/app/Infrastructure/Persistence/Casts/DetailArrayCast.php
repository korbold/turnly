<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

class DetailArrayCast implements CastsAttributes
{
    /**
     * Cast the stored value to the given type.
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        return json_decode($value, true, 512, JSON_PRESERVE_ZERO_FRACTION);
    }

    /**
     * Prepare the given value for storage.
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): string
    {
        return json_encode($value, JSON_PRESERVE_ZERO_FRACTION);
    }
}
