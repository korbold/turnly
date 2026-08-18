<?php
// apps/backend/app/Infrastructure/Http/Controllers/ServiceStaff/ServiceStaffController.php

namespace App\Infrastructure\Http\Controllers\ServiceStaff;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\ServiceStaffResource;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class ServiceStaffController extends Controller
{
    /**
     * Leer el catálogo lo puede hacer cualquier miembro: el select del
     * Registro Diario lo necesita para asignar. Escribirlo es del dueño —
     * el mismo criterio que la configuración del tenant.
     */
    private function mayEdit(Request $request): bool
    {
        if ($request->user()?->is_super_admin) {
            return true;
        }

        $role = TenantUserModel::where('tenant_id', app('current_tenant_id'))
            ->where('user_id', $request->user()->id)
            ->value('role');

        return in_array($role, ['owner', 'tenant_admin'], true);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => [
                'code'    => 'FORBIDDEN',
                'message' => 'Solo el administrador puede editar el personal.',
            ],
        ], 403);
    }

    public function index(Request $request): ResourceCollection
    {
        $query = ServiceStaffModel::query();

        // El select de Lavador pide ?position=washer y espera recibir también
        // a los que hacen ambos.
        $position = (string) $request->get('position', '');
        if (in_array($position, [ServiceStaffModel::POSITION_WASHER, ServiceStaffModel::POSITION_DRYER], true)) {
            $query->forPosition($position);
        }

        return ServiceStaffResource::collection(
            $query->orderBy('is_active', 'desc')->orderBy('name')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->mayEdit($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'name'      => 'required|string|max:120',
            'position'  => 'required|in:washer,dryer,both',
            'is_active' => 'sometimes|boolean',
        ]);

        $staff = ServiceStaffModel::create([
            'tenant_id' => app('current_tenant_id'),
            'name'      => $data['name'],
            'position'  => $data['position'],
            'is_active' => $data['is_active'] ?? true,
        ]);

        return (new ServiceStaffResource($staff))->response()->setStatusCode(201);
    }

    public function update(Request $request, string $id): ServiceStaffResource|JsonResponse
    {
        if (!$this->mayEdit($request)) {
            return $this->forbidden();
        }

        $staff = ServiceStaffModel::findOrFail($id);

        $data = $request->validate([
            'name'      => 'sometimes|string|max:120',
            'position'  => 'sometimes|in:washer,dryer,both',
            'is_active' => 'sometimes|boolean',
        ]);

        $staff->update($data);

        return new ServiceStaffResource($staff->fresh());
    }
}
