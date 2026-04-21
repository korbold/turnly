<?php

namespace App\Infrastructure\Http\Controllers\SuperAdmin;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\BusinessCategoryModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BusinessCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = BusinessCategoryModel::orderBy('sort_order')->get();

        return response()->json(['data' => $categories]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'emoji' => 'nullable|string|max:10',
            'color' => 'nullable|string|max:20',
            'description' => 'nullable|string|max:200',
            'icon' => 'nullable|string|max:50',
        ]);

        $slug = Str::slug($request->name, '_');

        if (BusinessCategoryModel::where('slug', $slug)->exists()) {
            $slug .= '_' . Str::random(4);
        }

        $maxOrder = BusinessCategoryModel::max('sort_order') ?? 0;

        $category = BusinessCategoryModel::create([
            'slug' => $slug,
            'name' => $request->name,
            'emoji' => $request->emoji ?? '🏪',
            'color' => $request->color ?? '#6B7280',
            'description' => $request->description,
            'icon' => $request->icon ?? 'store',
            'sort_order' => $maxOrder + 1,
            'is_active' => true,
        ]);

        return response()->json(['data' => $category], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $category = BusinessCategoryModel::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|max:100',
            'emoji' => 'sometimes|nullable|string|max:10',
            'color' => 'sometimes|nullable|string|max:20',
            'description' => 'sometimes|nullable|string|max:200',
            'icon' => 'sometimes|nullable|string|max:50',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0',
        ]);

        $category->update($request->only(['name', 'emoji', 'color', 'description', 'icon', 'is_active', 'sort_order']));

        return response()->json(['data' => $category]);
    }

    public function destroy(string $id): JsonResponse
    {
        $category = BusinessCategoryModel::findOrFail($id);
        $category->delete();

        return response()->json(['data' => ['message' => 'Category deleted']]);
    }
}
