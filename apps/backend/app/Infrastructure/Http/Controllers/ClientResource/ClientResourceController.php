<?php

namespace App\Infrastructure\Http\Controllers\ClientResource;

use App\Application\DTOs\ClientResource\CreateClientResourceDTO;
use App\Application\UseCases\ClientResource\CreateClientResourceUseCase;
use App\Application\UseCases\ClientResource\GetClientResourceHistoryUseCase;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\ClientResource\CreateClientResourceRequest;
use App\Infrastructure\Http\Resources\ClientResourceResource;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ClientResourceController extends Controller
{
    public function __construct(
        private CreateClientResourceUseCase $createClientResource,
        private GetClientResourceHistoryUseCase $getClientResourceHistory,
    ) {}

    public function index(Request $request)
    {
        $query = ClientResourceModel::with('client')
            ->orderBy('created_at', 'desc');

        $search = trim((string) $request->get('search', ''));

        if (!$request->boolean('all')) {
            $query->where('client_id', $request->user()->id);
        } else {
            $tenantId = app('current_tenant_id');
            // When browsing without a search term, hide staff-owned resources
            // so the clients list doesn't surface employees as customers.
            // When actively searching, include all resources so the cashier
            // can find any resource by owner name (e.g. an admin's own vehicle).
            if ($search === '') {
                $staffIds = TenantUserModel::where('tenant_id', $tenantId)
                    ->where('role', '!=', 'client')
                    ->pluck('user_id');
                $query->where(function ($q) use ($staffIds) {
                    $q->whereNotIn('client_id', $staffIds)
                        ->orWhereNull('client_id');
                });
            }
        }

        // Free-form search across the most-likely customer identifiers
        // staff types at the counter: plate, cédula/RUC, name, email.
        // The custom-field data JSON is searched with a single LIKE %q%
        // pass — MySQL evaluates each key/value pair as text, which is
        // good enough for the realistic cardinality (hundreds, not
        // millions) without forcing a JSON_TABLE rewrite.
        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('data', 'like', $like)
                    ->orWhereHas('client', function ($c) use ($like) {
                        $c->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like)
                            ->orWhere('phone', 'like', $like);
                    });
            });
        }

        $clientResources = $query->paginate($request->get('per_page', 15));

        return ClientResourceResource::collection($clientResources);
    }

    public function store(CreateClientResourceRequest $request): JsonResponse
    {
        $data = $request->data ?? [];
        $tenantId = app('current_tenant_id');

        $clientId = $request->client_id;

        if (!$clientId) {
            $user = $request->user();
            $tenantUser = TenantUserModel::where('user_id', $user->id)
                ->where('tenant_id', $tenantId)
                ->first();
            $isAdmin = $tenantUser && in_array($tenantUser->role, ['owner', 'tenant_admin']);

            if ($isAdmin) {
                $clientName = $this->extractClientName($data);
                if ($clientName) {
                    $client = $this->findOrCreateClient($clientName, $tenantId);
                    $clientId = $client->id;
                } else {
                    $clientId = $user->id;
                }
            } else {
                $clientId = $user->id;
            }
        }

        $dto = new CreateClientResourceDTO(
            tenantId: $tenantId,
            clientId: $clientId,
            data: $data,
        );

        $clientResource = $this->createClientResource->execute($dto);

        // Optional billing profile capture (Fase D). When the cashier
        // ships the form with billing data, persist it on the just-
        // created (or pre-existing) user so SRI invoicing has the
        // identity ready. First profile lands as default so check-in
        // auto-picks it without prompting.
        if (is_array($request->billing_profile) && !empty($request->billing_profile)) {
            $this->upsertBillingProfile($clientId, $request->billing_profile);
        }

        $model = ClientResourceModel::with('client')->find($clientResource->id);

        return (new ClientResourceResource($model))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Creates a billing profile for a user the admin is provisioning
     * via "Crear nuevo registro". Idempotent on (user, doc_type,
     * doc_number) — repeated cashiers don't end up with three copies
     * of the same RUC; legal_name + contact info refresh in place.
     */
    private function upsertBillingProfile(string $userId, array $payload): void
    {
        $docType = $payload['doc_type'] ?? 'final_consumer';
        if (!in_array($docType, ['ruc', 'cedula', 'passport', 'final_consumer'], true)) {
            return;
        }
        $docNumber = trim((string) ($payload['doc_number'] ?? ''));
        $legalName = trim((string) ($payload['legal_name'] ?? ''));

        if ($docType === 'final_consumer') {
            $docNumber = '9999999999999';
            $legalName = $legalName !== '' ? $legalName : 'CONSUMIDOR FINAL';
        } else {
            if ($docType === 'cedula' && !\App\Domain\Identity\EcuadorIdValidator::isCedula($docNumber)) return;
            if ($docType === 'ruc'    && !\App\Domain\Identity\EcuadorIdValidator::isRuc($docNumber))    return;
            if ($docNumber === '' || $legalName === '') return;
        }

        $email   = trim((string) ($payload['email']   ?? ''));
        $address = $payload['address'] ?? null;
        $phone   = $payload['phone']   ?? null;
        if ($email === '') return;

        \Illuminate\Support\Facades\DB::transaction(function () use ($userId, $docType, $docNumber, $legalName, $email, $address, $phone) {
            // First profile for this user becomes the default so the
            // check-in flow can auto-pick without prompting.
            $isFirst = !\App\Infrastructure\Persistence\Models\UserBillingProfileModel::where('user_id', $userId)->exists();

            \App\Infrastructure\Persistence\Models\UserBillingProfileModel::updateOrCreate(
                [
                    'user_id'    => $userId,
                    'doc_type'   => $docType,
                    'doc_number' => $docNumber,
                ],
                [
                    'legal_name' => $legalName,
                    'email'      => $email,
                    'address'    => $address,
                    'phone'      => $phone,
                    'is_default' => $isFirst,
                ],
            );
        });
    }

    public function show(string $id): ClientResourceResource
    {
        $clientResource = ClientResourceModel::with('client')->findOrFail($id);
        return new ClientResourceResource($clientResource);
    }

    public function update(Request $request, string $id): ClientResourceResource
    {
        $clientResource = ClientResourceModel::findOrFail($id);

        if ($this->hasReservations($clientResource)) {
            abort(422, 'No se puede editar un registro que tiene reservas');
        }

        $request->validate([
            'data' => 'nullable|array',
        ]);

        $clientResource->update([
            'data' => $request->data ?? [],
        ]);

        return new ClientResourceResource($clientResource->load('client'));
    }

    public function destroy(string $id): JsonResponse
    {
        $clientResource = ClientResourceModel::findOrFail($id);

        if ($this->hasReservations($clientResource)) {
            return response()->json([
                'error' => [
                    'code' => 'HAS_RESERVATIONS',
                    'message' => 'No se puede eliminar un registro que tiene reservas',
                ],
            ], 422);
        }

        $clientResource->delete();

        return response()->json(['message' => 'Registro eliminado'], 200);
    }

    private function hasReservations(ClientResourceModel $resource): bool
    {
        return \App\Infrastructure\Persistence\Models\ReservationModel::where('client_resource_id', $resource->id)->exists();
    }

    public function history(string $id): JsonResponse
    {
        $history = $this->getClientResourceHistory->execute($id);

        return response()->json([
            'data' => $history,
            'meta' => [
                'tenant' => app('current_tenant')->slug ?? null,
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Extract client name from data fields using tenant's custom_fields config.
     */
    private function extractClientName(array $data): ?string
    {
        $tenant = app('current_tenant');
        $customFields = $tenant->custom_fields ?? [];
        if (is_string($customFields)) {
            $customFields = json_decode($customFields, true) ?? [];
        }

        foreach ($customFields as $field) {
            $key   = $field['key'] ?? '';
            $label = strtolower($field['label'] ?? '');

            // The seeded base field uses key `nombre`; legacy tenants may
            // instead have labelled a field "Nombre del cliente". Match
            // either so the walk-in resolves to a real client user (and
            // isn't saved under the admin's own staff id, which the browse
            // filter then hides).
            $isNameField = $key === 'nombre'
                || (str_contains($label, 'nombre') && str_contains($label, 'cliente'));

            if ($isNameField && !empty($data[$key])) {
                return $data[$key];
            }
        }

        return null;
    }

    private function findOrCreateClient(string $name, string $tenantId): UserModel
    {
        $existing = UserModel::whereHas('tenants', function ($q) use ($tenantId) {
            $q->where('tenants.id', $tenantId)->where('tenant_users.role', 'client');
        })->where('name', $name)->first();

        if ($existing) {
            return $existing;
        }

        $user = UserModel::create([
            'name' => $name,
            'email' => Str::slug($name) . '-' . Str::random(4) . '@client.local',
            'password' => bcrypt(Str::random(16)),
        ]);

        TenantUserModel::create([
            'tenant_id' => $tenantId,
            'user_id' => $user->id,
            'role' => 'client',
            'is_active' => true,
        ]);

        return $user;
    }
}
