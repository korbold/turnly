<?php

namespace App\Infrastructure\Http\Controllers\ClientResource;

use App\Application\DTOs\ClientResource\CreateClientResourceDTO;
use App\Application\UseCases\ClientResource\CreateClientResourceUseCase;
use App\Application\UseCases\ClientResource\GetClientResourceHistoryUseCase;
use App\Domain\Identity\EcuadorIdValidator;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\ClientResource\CreateClientResourceRequest;
use App\Infrastructure\Http\Resources\ClientResourceResource;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
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
                // Name can come from a custom field, or (when the tenant
                // configured none) from the fiscal profile the cashier
                // typed. Falling back to the staff member's own id would
                // file the walk-in under an employee, and the clients
                // browse filter hides staff-owned resources — the record
                // would vanish from Clientes. Leave it unowned instead.
                $clientName = $this->extractClientName($data)
                    ?? $this->extractBillingName($request->billing_profile);

                $clientId = $clientName
                    ? $this->findOrCreateClient($clientName, $tenantId)->id
                    : null;
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
        if ($clientId && is_array($request->billing_profile) && !empty($request->billing_profile)) {
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
    /**
     * Returns the client's default fiscal profile, mapped for the admin
     * form. Falls back to CONSUMIDOR FINAL when none exists. Keyed by
     * client_resource_id (matches the rest of client-resources/{id}/*).
     */
    public function showBilling(string $id): JsonResponse
    {
        $resource = ClientResourceModel::with('client')->findOrFail($id);
        $client   = $resource->client;

        $profile = $client
            ? UserBillingProfileModel::where('user_id', $client->id)->where('is_default', true)->first()
            : null;

        return response()->json(['data' => [
            'doc_type'   => $profile->doc_type   ?? 'final_consumer',
            'doc_number' => $profile->doc_number ?? '',
            'legal_name' => $profile->legal_name ?? ($client->name ?? ''),
            'email'      => $profile->email      ?? ($client->email ?? ''),
            'address'    => $profile->address    ?? '',
            'phone'      => $profile->phone      ?? '',
        ]]);
    }

    /**
     * Edits the client's default fiscal profile in place (a typo fix must
     * not spawn a duplicate); creates one when none exists. Mirrors
     * ServiceLogController::updateBilling — same validation + response.
     */
    public function updateBilling(Request $request, string $id): JsonResponse
    {
        $resource = ClientResourceModel::with('client')->findOrFail($id);
        $client   = $resource->client;

        if (!$client) {
            return response()->json([
                'error' => ['code' => 'NO_CLIENT', 'message' => 'Este recurso no tiene cliente asociado.'],
            ], 422);
        }

        $data = $request->validate([
            'doc_type'   => ['required', 'in:final_consumer,cedula,ruc,passport'],
            'doc_number' => ['nullable', 'string', 'max:20'],
            'legal_name' => ['nullable', 'string', 'max:300'],
            'email'      => ['nullable', 'email', 'max:190'],
            'address'    => ['nullable', 'string', 'max:300'],
            'phone'      => ['nullable', 'string', 'max:40'],
        ]);

        $docType   = $data['doc_type'];
        $docNumber = trim((string) ($data['doc_number'] ?? ''));
        $legalName = trim((string) ($data['legal_name'] ?? ''));
        $email     = trim((string) ($data['email'] ?? ''));

        if ($docType === 'final_consumer') {
            $docNumber = '9999999999999';
            $legalName = $legalName !== '' ? $legalName : 'CONSUMIDOR FINAL';
        } else {
            if ($docType === 'cedula' && !EcuadorIdValidator::isCedula($docNumber)) {
                return response()->json(['error' => ['code' => 'INVALID_CEDULA', 'message' => 'Cédula inválida.']], 422);
            }
            if ($docType === 'ruc' && !EcuadorIdValidator::isRuc($docNumber)) {
                return response()->json(['error' => ['code' => 'INVALID_RUC', 'message' => 'RUC inválido.']], 422);
            }
            if ($docNumber === '' || $legalName === '') {
                return response()->json(['error' => ['code' => 'MISSING_FISCAL', 'message' => 'Documento y razón social son obligatorios.']], 422);
            }
            if ($email === '') {
                return response()->json(['error' => ['code' => 'MISSING_EMAIL', 'message' => 'El email es obligatorio para enviar el XML autorizado.']], 422);
            }
        }

        $attrs = [
            'doc_type'   => $docType,
            'doc_number' => $docNumber,
            'legal_name' => $legalName,
            'email'      => $email !== '' ? $email : null,
            'address'    => $data['address'] ?? null,
            'phone'      => $data['phone'] ?? null,
        ];

        $profile = UserBillingProfileModel::where('user_id', $client->id)->where('is_default', true)->first();

        if ($profile) {
            $profile->update($attrs);
        } else {
            $profile = UserBillingProfileModel::create($attrs + [
                'user_id'    => $client->id,
                'is_default' => true,
            ]);
        }

        return response()->json(['data' => [
            'doc_type'   => $profile->doc_type,
            'doc_number' => $profile->doc_number,
            'legal_name' => $profile->legal_name,
            'email'      => $profile->email ?? '',
            'address'    => $profile->address ?? '',
            'phone'      => $profile->phone ?? '',
        ]]);
    }

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

        $data = $request->data ?? [];

        $clientResource->update(['data' => $data]);

        // Naming an unowned walk-in promotes it to a real client: the
        // counter can complete the record next time the customer shows
        // up. An already-owned resource is left alone — reassigning an
        // owner is what the transfer endpoint is for.
        if (!$clientResource->client_id) {
            $name = $this->extractClientName($data);
            if ($name) {
                $clientResource->update([
                    'client_id' => $this->findOrCreateClient($name, app('current_tenant_id'))->id,
                ]);
            }
        }

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
        // Ensure the resource exists within the current tenant.
        ClientResourceModel::findOrFail($id);

        // Shape both service logs and reservations into the flat contract
        // the client-detail page consumes: { id, type, date, serviceName,
        // amount, status, paymentStatus }. The old use case returned raw
        // ServiceLog entities (camelCase, no `type`), which the frontend
        // silently discarded — and it never included reservations.
        $services = ServiceLogModel::with(['service', 'items'])
            ->where('client_resource_id', $id)
            ->get()
            ->map(function (ServiceLogModel $log) {
                $items = $log->items;
                $label = $items && $items->isNotEmpty()
                    ? $items->first()->label . ($items->count() > 1 ? ' +' . ($items->count() - 1) . ' más' : '')
                    : ($log->service?->name ?? 'Servicio');

                return [
                    'id'            => $log->id,
                    'type'          => 'service',
                    'date'          => ($log->started_at ?? $log->created_at)?->toIso8601String(),
                    'serviceName'   => $label,
                    'amount'        => (float) $log->price_charged,
                    'status'        => $log->status,
                    'paymentStatus' => $log->payment_status,
                ];
            });

        $reservations = ReservationModel::with('service')
            ->where('client_resource_id', $id)
            ->get()
            ->map(fn (ReservationModel $r) => [
                'id'          => $r->id,
                'type'        => 'reservation',
                'date'        => $r->scheduled_at?->toIso8601String(),
                'serviceName' => $r->service?->name ?? 'Reserva',
                'status'      => $r->status,
            ]);

        $history = $services->concat($reservations)
            ->sortByDesc('date')
            ->values()
            ->all();

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
        // Tenants with no name field in custom_fields still get asked for
        // one by the walk-in form, which ships it under the conventional
        // `nombre` key. Honour it before consulting the config, otherwise
        // the typed name would be silently dropped.
        if (!empty($data['nombre']) && is_string($data['nombre'])) {
            $direct = trim($data['nombre']);
            if ($direct !== '') {
                return $direct;
            }
        }

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

    /**
     * Second-chance client name for tenants whose custom_fields carry no
     * name field: the razón social the cashier typed in "Datos de
     * facturación". CONSUMIDOR FINAL is a placeholder, not a person, so
     * it never names a client.
     */
    private function extractBillingName(mixed $billingProfile): ?string
    {
        if (!is_array($billingProfile)) {
            return null;
        }

        $legalName = trim((string) ($billingProfile['legal_name'] ?? ''));

        if ($legalName === '' || strcasecmp($legalName, 'CONSUMIDOR FINAL') === 0) {
            return null;
        }

        return $legalName;
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
