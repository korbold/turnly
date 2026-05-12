<?php

namespace App\Infrastructure\Http\Controllers;

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AvailabilitySlotController extends Controller
{
    public function index(): JsonResponse
    {
        $slots = AvailabilitySlotModel::orderBy('day_of_week')->get();

        return response()->json(['data' => $slots]);
    }

    public function bulkUpdate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'slots' => 'required|array',
            'slots.*.day_of_week' => 'required|integer|min:0|max:6',
            'slots.*.start_time' => 'nullable|date_format:H:i',
            'slots.*.end_time' => 'nullable|date_format:H:i',
            'slots.*.is_active' => 'required|boolean',
            'slots.*.max_concurrent' => 'integer|min:1',
        ]);

        $tenantId = app('current_tenant_id');

        // Delete all existing slots for this tenant and recreate
        AvailabilitySlotModel::query()
            ->forTenant($tenantId)
            ->delete();

        foreach ($validated['slots'] as $slotData) {
            if (!$slotData['is_active']) {
                continue;
            }
            AvailabilitySlotModel::withoutGlobalScopes()->create([
                'tenant_id' => $tenantId,
                'day_of_week' => $slotData['day_of_week'],
                'start_time' => ($slotData['start_time'] ?? '08:00') . ':00',
                'end_time' => ($slotData['end_time'] ?? '18:00') . ':00',
                'is_active' => true,
                'max_concurrent' => $slotData['max_concurrent'] ?? 2,
            ]);
        }

        $slots = AvailabilitySlotModel::orderBy('day_of_week')->orderBy('start_time')->get();

        return response()->json(['data' => $slots]);
    }
}
