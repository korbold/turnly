<?php

namespace App\Infrastructure\Http\Requests\Vehicle;

use Illuminate\Foundation\Http\FormRequest;

class CreateVehicleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'plate'  => ['required', 'string', 'max:20'],
            'brand'  => ['nullable', 'string', 'max:100'],
            'model'  => ['nullable', 'string', 'max:100'],
            'color'  => ['nullable', 'string', 'max:50'],
            'type'   => ['nullable', 'in:sedan,suv,pickup,van,motorcycle,other'],
        ];
    }
}
