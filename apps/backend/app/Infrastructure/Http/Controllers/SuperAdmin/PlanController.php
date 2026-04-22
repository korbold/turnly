<?php

namespace App\Infrastructure\Http\Controllers\SuperAdmin;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\PlanResource;
use App\Infrastructure\Persistence\Models\PlanModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = PlanModel::withCount('tenants')->orderBy('sort_order')->get();

        return response()->json(['data' => PlanResource::collection($plans)]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'                       => 'required|string|max:100',
            'price'                      => 'required|numeric|min:0',
            'max_services'               => 'nullable|integer|min:0',
            'max_reservations_per_month' => 'nullable|integer|min:0',
            'max_employees'              => 'nullable|integer|min:0',
            'has_push_notifications'     => 'boolean',
            'has_reports'                => 'boolean',
            'has_reminders'              => 'boolean',
            'has_custom_page'            => 'boolean',
            'description'                => 'nullable|string|max:500',
        ]);

        $slug = Str::slug($request->name, '_');
        if (PlanModel::where('slug', $slug)->exists()) {
            $slug .= '_' . Str::random(4);
        }

        $maxOrder = PlanModel::max('sort_order') ?? 0;

        $plan = PlanModel::create([
            'name'                       => $request->name,
            'slug'                       => $slug,
            'price'                      => $request->price,
            'max_services'               => $request->max_services,
            'max_reservations_per_month' => $request->max_reservations_per_month,
            'max_employees'              => $request->max_employees,
            'has_push_notifications'     => $request->boolean('has_push_notifications'),
            'has_reports'                => $request->boolean('has_reports'),
            'has_reminders'              => $request->boolean('has_reminders'),
            'has_custom_page'            => $request->boolean('has_custom_page'),
            'is_active'                  => true,
            'sort_order'                 => $maxOrder + 1,
            'description'                => $request->description,
        ]);

        return response()->json(['data' => new PlanResource($plan)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $plan = PlanModel::findOrFail($id);

        $request->validate([
            'name'                       => 'sometimes|string|max:100',
            'price'                      => 'sometimes|numeric|min:0',
            'max_services'               => 'nullable|integer|min:0',
            'max_reservations_per_month' => 'nullable|integer|min:0',
            'max_employees'              => 'nullable|integer|min:0',
            'has_push_notifications'     => 'sometimes|boolean',
            'has_reports'                => 'sometimes|boolean',
            'has_reminders'              => 'sometimes|boolean',
            'has_custom_page'            => 'sometimes|boolean',
            'is_active'                  => 'sometimes|boolean',
            'sort_order'                 => 'sometimes|integer|min:0',
            'description'                => 'sometimes|nullable|string|max:500',
        ]);

        $plan->update($request->only([
            'name', 'price',
            'max_services', 'max_reservations_per_month', 'max_employees',
            'has_push_notifications', 'has_reports', 'has_reminders', 'has_custom_page',
            'is_active', 'sort_order', 'description',
        ]));

        return response()->json(['data' => new PlanResource($plan)]);
    }

    public function destroy(string $id): JsonResponse
    {
        $plan = PlanModel::findOrFail($id);
        $plan->delete();

        return response()->json(['data' => ['message' => 'Plan deleted']]);
    }
}
