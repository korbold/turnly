<?php

namespace App\Infrastructure\Http\Controllers;

use App\Infrastructure\Persistence\Models\AvailabilityBlockModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AvailabilityBlockController extends Controller
{
    public function index(): JsonResponse
    {
        $blocks = AvailabilityBlockModel::orderBy('date', 'desc')->get();

        return response()->json(['data' => $blocks]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i|after:start_time',
            'reason' => 'nullable|string|max:255',
        ]);

        $block = AvailabilityBlockModel::create([
            'tenant_id' => app('current_tenant_id'),
            'date' => $validated['date'],
            'start_time' => $validated['start_time'] ?? null,
            'end_time' => $validated['end_time'] ?? null,
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json(['data' => $block], 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $block = AvailabilityBlockModel::findOrFail($id);
        $block->delete();

        return response()->json(['data' => ['message' => 'Block deleted']]);
    }
}
