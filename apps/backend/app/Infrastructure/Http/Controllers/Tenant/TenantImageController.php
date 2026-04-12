<?php

namespace App\Infrastructure\Http\Controllers\Tenant;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\TenantImageModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantImageController extends Controller
{
    public function index(): JsonResponse
    {
        $images = TenantImageModel::where('tenant_id', app('current_tenant_id'))
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'data' => $images,
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'url' => ['required', 'string', 'max:500'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $count = TenantImageModel::where('tenant_id', app('current_tenant_id'))->count();
        if ($count >= 10) {
            return response()->json([
                'error' => ['code' => 'LIMIT_REACHED', 'message' => 'Máximo 10 imágenes por negocio'],
            ], 422);
        }

        $image = TenantImageModel::create([
            'tenant_id' => app('current_tenant_id'),
            'url' => $request->url,
            'caption' => $request->caption,
            'sort_order' => $count,
        ]);

        return response()->json([
            'data' => $image,
            'meta' => ['timestamp' => now()->toIso8601String()],
        ], 201);
    }

    public function destroy(string $id): JsonResponse
    {
        TenantImageModel::where('tenant_id', app('current_tenant_id'))
            ->where('id', $id)
            ->delete();

        return response()->json([
            'data' => ['message' => 'Image deleted'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function reorder(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['uuid'],
        ]);

        foreach ($request->ids as $index => $id) {
            TenantImageModel::where('tenant_id', app('current_tenant_id'))
                ->where('id', $id)
                ->update(['sort_order' => $index]);
        }

        return response()->json([
            'data' => ['message' => 'Order updated'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
