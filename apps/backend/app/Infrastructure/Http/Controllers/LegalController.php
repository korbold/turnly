<?php

namespace App\Infrastructure\Http\Controllers;

use Illuminate\Http\JsonResponse;

class LegalController extends Controller
{
    private const VERSION = '1.0';
    private const UPDATED_AT = '2026-04-25';

    public function show(string $type): JsonResponse
    {
        if (!in_array($type, ['terms', 'privacy'], true)) {
            abort(404);
        }

        $path = storage_path("legal/{$type}.md");
        if (!is_file($path)) {
            abort(404);
        }

        return response()->json([
            'data' => [
                'type' => $type,
                'version' => self::VERSION,
                'updated_at' => self::UPDATED_AT,
                'content' => file_get_contents($path),
            ],
        ]);
    }
}
