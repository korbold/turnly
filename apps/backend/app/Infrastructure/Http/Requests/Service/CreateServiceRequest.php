<?php

namespace App\Infrastructure\Http\Requests\Service;

use App\Domain\ServiceLog\ServiceStaffing;
use Illuminate\Foundation\Http\FormRequest;

class CreateServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'             => ['required', 'string', 'max:255'],
            'description'      => ['nullable', 'string'],
            'price'            => ['required', 'numeric', 'min:0'],
            'is_active'        => ['nullable', 'boolean'],
            'staffing'         => ['nullable', 'string', 'in:' . implode(',', ServiceStaffing::VALUES)],
            'sort_order'       => ['nullable', 'integer', 'min:0'],
            'image_url'        => ['nullable', 'string', 'max:500'],
        ];
    }
}
