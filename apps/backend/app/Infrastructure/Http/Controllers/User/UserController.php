<?php

namespace App\Infrastructure\Http\Controllers\User;

use App\Application\Services\PlanLimitsService;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\UserResource;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function __construct(
        private PlanLimitsService $planLimits,
    ) {}

    public function index(Request $request)
    {
        $tenantId = app('current_tenant_id');

        $query = UserModel::whereHas('tenants', function ($q) use ($tenantId, $request) {
            $q->where('tenants.id', $tenantId);
            if ($request->has('role')) {
                $q->where('tenant_users.role', $request->role);
            }
            if ($request->has('exclude_role')) {
                $q->where('tenant_users.role', '!=', $request->exclude_role);
            }
        })->with(['tenants' => function ($q) use ($tenantId) {
            $q->where('tenants.id', $tenantId);
        }]);

        $users = $query->paginate($request->get('per_page', 15));

        return UserResource::collection($users);
    }

    public function show(string $id): UserResource
    {
        $tenantId = app('current_tenant_id');

        $user = UserModel::whereHas('tenants', fn ($q) => $q->where('tenants.id', $tenantId))
            ->findOrFail($id);

        return new UserResource($user);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'username' => ['required', 'string', 'min:3', 'max:60', 'regex:/^[a-z0-9._-]+$/', Rule::unique('users', 'username')],
            'password' => 'required|string|min:6',
            'email'    => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone'    => 'nullable|string|max:20',
            'role'     => 'required|in:tenant_admin,cashier,washer',
        ]);

        $tenantId = app('current_tenant_id');

        if (!$this->planLimits->canAddEmployee($tenantId)) {
            return response()->json([
                'error' => ['code' => 'PLAN_LIMIT', 'message' => 'Límite de empleados alcanzado. Actualiza tu plan.'],
            ], 403);
        }

        $user = UserModel::create([
            'name'     => $data['name'],
            'username' => strtolower($data['username']),
            'password' => $data['password'], // hashed by model cast
            'email'    => $data['email'] ?? null,
            'phone'    => $data['phone'] ?? null,
            'is_super_admin' => false,
        ]);

        // Admin-created staff are trusted; mark verified. forceFill because
        // email_verified_at is intentionally not fillable (mass-assign guard,
        // same rationale as is_super_admin).
        $user->forceFill(['email_verified_at' => now()])->save();

        TenantUserModel::create([
            'tenant_id' => $tenantId,
            'user_id'   => $user->id,
            'role'      => $data['role'],
            'is_active' => true,
        ]);

        return response()->json([
            'data' => [
                'user' => [
                    'id'       => $user->id,
                    'name'     => $user->name,
                    'username' => $user->username,
                    'email'    => $user->email,
                    'role'     => $data['role'],
                ],
                'message' => 'Miembro creado exitosamente',
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ], 201);
    }

    public function updateRole(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'role' => 'required|in:tenant_admin,cashier,washer,client',
        ]);

        $membership = TenantUserModel::where('tenant_id', app('current_tenant_id'))
            ->where('user_id', $id)
            ->first();

        if (!$membership) {
            return response()->json([
                'error' => ['code' => 'NOT_FOUND', 'message' => 'Miembro no encontrado'],
            ], 404);
        }

        // Al dueño no lo baja nadie, y nadie se cambia el rol a sí mismo: un
        // admin que se degrada por error deja al negocio sin quien lo arregle.
        if ($membership->role === 'owner' || $id === $request->user()->id) {
            return response()->json([
                'error' => ['code' => 'FORBIDDEN', 'message' => 'Ese rol no se puede cambiar.'],
            ], 403);
        }

        $membership->update(['role' => $request->role]);

        return response()->json([
            'data' => ['message' => 'Role updated'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function resetPassword(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'password' => 'required|string|min:6|max:255',
        ]);

        $tenantId = app('current_tenant_id');

        // Only allow resetting passwords of users that belong to the current tenant.
        $role = TenantUserModel::where('tenant_id', $tenantId)
            ->where('user_id', $id)
            ->value('role');

        if (!$role) {
            return response()->json([
                'error' => ['code' => 'NOT_FOUND', 'message' => 'Miembro no encontrado'],
            ], 404);
        }

        // La contraseña es de toda la plataforma, no de este negocio. Solo se
        // cambia la del personal que existe únicamente aquí: no la del dueño,
        // no la de un cliente, y no la de alguien que también está en otro
        // negocio —vincularlo como cliente bastaba para quitarle la cuenta—.
        $elsewhere = TenantUserModel::where('user_id', $id)
            ->where('tenant_id', '!=', $tenantId)
            ->exists();

        if (!in_array($role, ['tenant_admin', 'cashier', 'washer'], true) || $elsewhere) {
            return response()->json([
                'error' => [
                    'code' => 'FORBIDDEN',
                    'message' => 'Esta persona cambia su contraseña desde «Olvidé mi contraseña».',
                ],
            ], 403);
        }

        $user = UserModel::findOrFail($id);
        $user->password = Hash::make($data['password']);
        $user->save();

        // Invalidate any active sessions so the old password stops working.
        $user->tokens()->delete();

        return response()->json([
            'data' => ['message' => 'Contraseña actualizada'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    /**
     * Admin patch of a client's contact info. Allowed only when the user
     * is still a ghost (never claimed an account from the app) AND the
     * client belongs to the current tenant. Once the customer claims
     * the account they own these fields exclusively.
     */
    public function updateClient(Request $request, string $id): JsonResponse
    {
        $tenantId = app('current_tenant_id');

        $belongs = TenantUserModel::where('tenant_id', $tenantId)
            ->where('user_id', $id)
            ->where('role', 'client')
            ->exists();
        if (!$belongs) {
            return response()->json([
                'error' => ['code' => 'NOT_FOUND', 'message' => 'Cliente no encontrado'],
            ], 404);
        }

        $user = UserModel::findOrFail($id);
        if (!$user->isGhost()) {
            return response()->json([
                'error' => [
                    'code' => 'CLAIMED',
                    'message' => 'El cliente activó su cuenta. Solo él puede editar sus datos.',
                ],
            ], 403);
        }

        $data = $request->validate([
            'name'  => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $user->fill(array_filter($data, fn ($v) => $v !== null));
        $user->save();

        return response()->json([
            'data' => [
                'id'    => $user->id,
                'name'  => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'is_ghost' => $user->isGhost(),
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
