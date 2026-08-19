<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Cash;

use App\Application\Services\CashRegister;
use App\Domain\Cash\CashRegisterException;
use App\Domain\Tenant\StaffPrivileges;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\CashMovementResource;
use App\Infrastructure\Http\Resources\CashSessionResource;
use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CashSessionController extends Controller
{
    public function __construct(private CashRegister $cash) {}

    /**
     * Mismo criterio que ServiceLogController::may(): el super-admin no tiene
     * fila en tenant_users y el dueño nunca queda afuera de su propio local.
     */
    private function mayManage(Request $request): bool
    {
        if ($request->user()?->is_super_admin) {
            return true;
        }

        $role = TenantUserModel::where('tenant_id', app('current_tenant_id'))
            ->where('user_id', $request->user()->id)
            ->value('role');

        $permissions = TenantModel::find(app('current_tenant_id'))?->settings['permissions'] ?? [];

        return StaffPrivileges::granted(
            $role,
            StaffPrivileges::CASH,
            is_array($permissions) ? $permissions : [],
        );
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => [
                'code'    => 'FORBIDDEN',
                'message' => 'No tenés permiso para manejar la caja.',
            ],
        ], 403);
    }

    private function fromException(CashRegisterException $e): JsonResponse
    {
        return response()->json([
            'error' => ['code' => $e->errorCode, 'message' => $e->getMessage()],
        ], 422);
    }

    /**
     * La caja de un día. Devuelve `data: null` cuando ese día no tuvo caja —
     * un 404 haría que el front trate "todavía no abrieron" como un error.
     */
    public function current(Request $request): JsonResponse
    {
        if (!$this->mayManage($request)) {
            return $this->forbidden();
        }

        $tenantId = app('current_tenant_id');
        $date = (string) $request->get('date', now()->toDateString());

        $session = $this->cash->sessionFor($tenantId, $date);
        $session?->load(['movements.author', 'opener', 'closer']);

        return response()->json([
            'data' => $session ? new CashSessionResource($session) : null,
            'meta' => [
                'cash_without_session' => $this->cash->cashCollectedWithoutSession($tenantId, $date),
            ],
        ]);
    }

    public function open(Request $request): JsonResponse
    {
        if (!$this->mayManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'business_date'  => 'sometimes|date',
            'opening_amount' => 'required|numeric|min:0',
        ]);

        try {
            $session = $this->cash->openSession(
                app('current_tenant_id'),
                (string) ($data['business_date'] ?? now()->toDateString()),
                (float) $data['opening_amount'],
                $request->user()?->id,
            );
        } catch (CashRegisterException $e) {
            return $this->fromException($e);
        }

        $session->load(['movements.author', 'opener', 'closer']);

        return (new CashSessionResource($session))->response()->setStatusCode(201);
    }

    public function addMovement(Request $request, string $id): JsonResponse
    {
        if (!$this->mayManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            // Un egreso sin motivo es un faltante con otro nombre.
            'type'   => 'required|in:expense,withdrawal,deposit',
            'amount' => 'required|numeric|min:0.01',
            'reason' => 'required|string|max:200',
        ]);

        // findOrFail bajo el TenantScope: la caja de otro tenant es un 404,
        // no un 403 — no confirmamos que el id exista.
        $session = CashSessionModel::findOrFail($id);

        try {
            $movement = $this->cash->addMovement(
                $session,
                $data['type'],
                (float) $data['amount'],
                $data['reason'],
                $request->user()?->id,
            );
        } catch (CashRegisterException $e) {
            return $this->fromException($e);
        }

        return (new CashMovementResource($movement->load('author')))
            ->response()->setStatusCode(201);
    }

    public function close(Request $request, string $id): JsonResponse
    {
        if (!$this->mayManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'counted_amount' => 'required|numeric|min:0',
            'notes'          => 'sometimes|nullable|string|max:500',
        ]);

        $session = CashSessionModel::findOrFail($id);

        try {
            $cerrada = $this->cash->closeSession(
                $session,
                (float) $data['counted_amount'],
                $request->user()?->id,
                $data['notes'] ?? null,
            );
        } catch (CashRegisterException $e) {
            return $this->fromException($e);
        }

        $cerrada->load(['movements.author', 'opener', 'closer']);

        return (new CashSessionResource($cerrada))->response()->setStatusCode(200);
    }
}
