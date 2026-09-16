<?php

namespace App\Infrastructure\Http\Controllers\Service;

use App\Application\Services\PlanLimitsService;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Service\CreateServiceRequest;
use App\Infrastructure\Http\Requests\Service\UpdateServiceRequest;
use App\Infrastructure\Http\Resources\ServiceResource;
use App\Infrastructure\Persistence\Models\ServiceModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function __construct(
        private PlanLimitsService $planLimits,
    ) {}

    public function index(Request $request)
    {
        // El catálogo entero se crea con sort_order 0, así que sin desempate
        // MySQL reparte los empates a su antojo y un servicio puede no caer en
        // ninguna página.
        $query = ServiceModel::orderBy('sort_order')
            ->orderBy('name')
            ->orderBy('id');

        // La búsqueda va del lado del servidor a propósito: filtrar en el
        // cliente sólo miraría la página que ya llegó y volvería a esconder
        // servicios, que es justo lo que el paginado no debe reintroducir.
        $q = trim((string) $request->get('q', ''));
        if ($q !== '') {
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $q) . '%';
            $query->where(function ($w) use ($like) {
                $w->where('name', 'like', $like)
                  ->orWhere('description', 'like', $like);
            });
        }

        // "all" es una sola página del tamaño del catálogo: conserva la forma de
        // la respuesta y evita que la lista o un selector se coman los
        // servicios que no entraron en los primeros 50.
        $requested = (string) $request->get('per_page', 50);
        $perPage = $requested === 'all'
            ? max($query->clone()->count(), 1)
            : max(min((int) $requested ?: 50, 200), 1);

        return ServiceResource::collection($query->paginate($perPage));
    }

    public function show(string $id): ServiceResource
    {
        $service = ServiceModel::with('variants.consumption.product')->findOrFail($id);
        return new ServiceResource($service);
    }

    public function store(CreateServiceRequest $request): JsonResponse
    {
        if (!$this->planLimits->canCreateService(app('current_tenant_id'))) {
            return response()->json([
                'error' => ['code' => 'PLAN_LIMIT', 'message' => 'Límite de servicios alcanzado. Actualiza tu plan.'],
            ], 403);
        }

        $service = ServiceModel::create([
            'tenant_id' => app('current_tenant_id'),
            ...$request->validated(),
        ]);

        return (new ServiceResource($service))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateServiceRequest $request, string $id): ServiceResource
    {
        $service = ServiceModel::findOrFail($id);
        $service->update($request->validated());

        return new ServiceResource($service->fresh());
    }

    public function destroy(string $id): JsonResponse
    {
        $service = ServiceModel::findOrFail($id);
        $service->delete(); // soft delete

        return response()->json([
            'data' => ['message' => 'Service deleted'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
