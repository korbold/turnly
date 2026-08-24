<?php

namespace App\Infrastructure\Http\Requests\Service;

use Illuminate\Foundation\Http\FormRequest;

class UpdateServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'             => ['nullable', 'string', 'max:255'],
            'description'      => ['nullable', 'string'],
            'price'            => ['nullable', 'numeric', 'min:0'],
            'is_active'        => ['nullable', 'boolean'],
            'requires_dryer'   => ['nullable', 'boolean'],
            'sort_order'       => ['nullable', 'integer', 'min:0'],
            'image_url'        => ['nullable', 'string', 'max:500'],
        ];
    }
}
