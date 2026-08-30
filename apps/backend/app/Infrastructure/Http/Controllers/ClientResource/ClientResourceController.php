<?php

namespace App\Infrastructure\Http\Controllers\ClientResource;

use App\Infrastructure\Http\Support\CurrentTenant;
use App\Application\DTOs\ClientResource\CreateClientResourceDTO;
use App\Application\UseCases\ClientResource\CreateClientResourceUseCase;
use App\Application\UseCases\ClientResource\GetClientResourceHistoryUseCase;
use App\Domain\Identity\EcuadorIdValidator;
use App\Domain\ClientResource\Plate;
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

    /**
     * El recurso del tenant que ya tiene esta placa, o null.
     *
     * Se compara normalizado (sin guiones ni espacios, en mayúsculas) porque
     * el cajero escribe con el auto adelante. Y se recorre en PHP en vez de
     * en SQL porque la placa vive dentro de `data`, cuyas claves son campos
     * personalizados por tenant —uno guarda "plate" y otro "placa"—: son unos
     * cientos de filas por tenant y una consulta por alta.
     */
    private function plateOwner(string $tenantId, ?string $plate): ?ClientResourceModel
    {
        if ($plate === null || Plate::isPlaceholder($plate)) {
            return null;
        }

        $buscada = Plate::normalize($plate);

        return ClientResourceModel::query()
            ->forTenant($tenantId)
            ->get(['id', 'client_id', 'data'])
            ->first(fn ($r) => Plate::normalize(Plate::fromData($r->data)) === $buscada);
    }

    /** El nombre tecleado gana sobre el del usuario ligado: en un walk-in ese
     *  usuario puede ser la cajera. */
    private function resourceClientName(ClientResourceModel $resource): ?string
    {
        return $this->extractClientName($resource->data ?? [])
            ?? $resource->client?->name;
    }

    public function index(Request $request)
    {
        $query = ClientResourceModel::with('client')
            ->orderBy('created_at', 'desc');

        $search = trim((string) $request->get('search', ''));

        if (!$request->boolean('all')) {
            $query->where('client_id', $request->user()->id);
        } else {
            $tenantId = CurrentTenant::id();
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

        // Los vehículos de una persona. La ficha de la persona los pide así
        // en vez de filtrar la página en el navegador: con la lista paginada,
        // el segundo auto puede estar en otra página.
        if ($request->filled('client_id')) {
            $query->where('client_id', $request->get('client_id'));
        }

        // Free-form search across the most-likely customer identifiers
        // staff types at the counter: plate, cédula/RUC, name, email.
        // The custom-field data JSON is searched with a single LIKE %q%
        // pass — MySQL evaluates each key/value pair as text, which is
        // good enough for the realistic cardinality (hundreds, not
        // millions) without forcing a JSON_TABLE rewrite.
        //
        // LOWER(CAST(data AS CHAR)) instead of a plain LIKE: a MySQL JSON
        // column compares with a binary collation, so `data LIKE '%ibf%'`
        // never matches a stored "IBF7520". Lowercasing both sides makes the
        // plate search behave like the varchar columns below, which are
        // already case-insensitive under utf8mb4_unicode_ci.
        if ($search !== '') {
            $like = '%' . $search . '%';
            $likeLower = '%' . mb_strtolower($search) . '%';
            $query->where(function ($q) use ($like, $likeLower) {
                $q->whereRaw('LOWER(CAST(data AS CHAR)) LIKE ?', [$likeLower])
                    ->orWhereHas('client', function ($c) use ($like) {
                        $c->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like)
                            ->orWhere('phone', 'like', $like);
                    });
            });
        }

        // El saldo de TODAS las placas del tenant en dos consultas agregadas.
        // Una consulta por fila convertiría la pantalla del lunes en un
        // timeout con doscientos vehículos.
        // Sin negocio no hay deuda que mostrar, y no es motivo para negarle al
        // cliente la lista de sus propias cosas: la deuda es dato de mostrador.
        $tenantForDebt = CurrentTenant::idOrNull();
        $deudas = $tenantForDebt
            ? app(\App\Application\Services\DebtLedger::class)->debtByResource($tenantForDebt)
            : [];

        // El toggle "Solo con deuda". El `?: ['-']` es lo que hace que un
        // tenant sin deudores devuelva vacío en vez de devolver todo.
        if ($request->boolean('with_debt')) {
            $query->whereIn('id', array_keys($deudas) ?: ['-']);
        }

        $clientResources = $query->paginate($request->get('per_page', 15));

        // El saldo viaja en el modelo, no en `meta`: el recurso lo lee sin
        // que el front tenga que cruzar dos estructuras.
        $clientResources->getCollection()->transform(function ($r) use ($deudas) {
            $r->setAttribute('debt_amount', (float) ($deudas[$r->id] ?? 0));
            return $r;
        });

        return ClientResourceResource::collection($clientResources);
    }

    public function store(CreateClientResourceRequest $request): JsonResponse
    {
        $data = $request->data ?? [];
        $tenantId = CurrentTenant::id();

        // La misma placa no puede entrar dos veces. El formulario ya
        // consultaba `lookup`, pero buscaba en la columna `plate` —que nadie
        // llena— y siempre contestaba que no existía: en producción la misma
        // placa quedó cargada hasta cuatro veces, con su historial y su deuda
        // partidos. Acá se cierra del lado que no se puede saltear.
        if ($ya = $this->plateOwner($tenantId, Plate::fromData($data))) {
            return response()->json([
                'error' => [
                    'code'     => 'DUPLICATE_PLATE',
                    'message'  => 'Esa placa ya está registrada. Usá el vehículo que ya existe.',
                    // Para que el mostrador pueda elegirlo en vez de quedarse
                    // con un "no se puede" que no dice qué hacer.
                    'existing' => [
                        'id'          => $ya->id,
                        'label'       => ClientResourceResource::labelFrom($ya->data),
                        'client_name' => $this->resourceClientName($ya),
                    ],
                ],
            ], 422);
        }

        // De quién queda el vehículo.
        //
        // Esto valía sólo para el dueño y el admin; para el cajero el auto
        // quedaba colgado de SU usuario. Por el mostrador entra todo el
        // trabajo real, así que en producción 237 de 274 vehículos figuraban
        // como de la cajera — y como la lista de Clientes esconde a propósito
        // lo que cuelga del personal, la pantalla mostraba 37 de 274.
        //
        // La regla es "el empleado no se queda con el vehículo", no "nadie se
        // queda con el vehículo": un cliente que registra su auto desde la app
        // sí es su dueño.
        $clientId = $request->client_id;

        if (!$clientId) {
            $user = $request->user();
            $rol = TenantUserModel::where('user_id', $user->id)
                ->where('tenant_id', $tenantId)
                ->value('role');

            $esPersonal = in_array($rol, ['owner', 'tenant_admin', 'cashier', 'washer'], true);

            if ($esPersonal) {
                // El nombre puede venir de un campo personalizado o —cuando el
                // tenant no configuró ninguno— del perfil fiscal que tecleó el
                // cajero. Sin nombre no hay persona, y el auto queda sin dueño:
                // es honesto, y así aparece en Clientes.
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
            'data'      => 'nullable|array',
            'client_id' => 'nullable|uuid',
        ]);

        $data = $request->data ?? [];

        $clientResource->update(['data' => $data]);

        // Un `client_id` explícito es una decisión deliberada: alguien buscó a
        // la persona y la eligió. Vale también sobre un auto que ya tenía
        // dueño, porque equivocarse de persona buscando por nombre es fácil y
        // sin esto el auto quedaría trabado con el dueño equivocado.
        //
        // El nombre escrito, en cambio, sólo promueve un walk-in que estaba
        // suelto: corregir el color de un auto no puede cambiarle el dueño.
        $clientId = $request->input('client_id');

        if (!$clientId && !$clientResource->client_id) {
            $name = $this->extractClientName($data);
            $clientId = $name
                ? $this->findOrCreateClient($name, CurrentTenant::id())->id
                : null;
        }

        if ($clientId && $clientId !== $clientResource->client_id) {
            $clientResource->update(['client_id' => $clientId]);
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

        // Lo mismo con el trabajo ya hecho, que hasta ahora pasaba de largo:
        // el candado protegía la agenda y dejaba pasar la plata.
        //
        // `service_logs.client_resource_id` es ON DELETE SET NULL, así que
        // borrar el vehículo no borra sus servicios: los deja sin auto, con su
        // precio, su cobro y su bitácora intactos. En producción quedaron 11
        // servicios cobrados así entre el 2 y el 25 de agosto — no se puede
        // saber sobre qué vehículo se trabajó, y el cliente los pierde de su
        // historial y de su total gastado. La base lo hace sin tocar
        // `updated_at` ni escribir en la bitácora, así que no deja rastro.
        //
        // Un registro anulado cuenta igual: sigue siendo historia de la placa.
        // Para juntar dos fichas de la misma placa existe
        // `clients:merge-duplicate-plates`, que reasigna los servicios antes
        // de borrar en vez de dejarlos huérfanos.
        $servicios = ServiceLogModel::where('client_resource_id', $clientResource->id)->count();

        if ($servicios > 0) {
            return response()->json([
                'error' => [
                    'code'     => 'HAS_SERVICES',
                    'message'  => $servicios === 1
                        ? 'Este vehículo tiene 1 servicio en su historial. Podés sacarlo de tu lista y el local lo conserva.'
                        : "Este vehículo tiene {$servicios} servicios en su historial. Podés sacarlo de tu lista y el local los conserva.",
                    // Cuántos, para que el mostrador sepa si es un ticket de
                    // prueba o el historial de un año.
                    'services' => $servicios,
                    // El mensaje lo lee el dueño del auto en el móvil, no un
                    // empleado. Un "no se puede" sin salida es lo que hace que
                    // insista o llame al local; `release` es la salida.
                    'can_release' => true,
                ],
            ], 422);
        }

        $clientResource->delete();

        return response()->json(['message' => 'Registro eliminado'], 200);
    }

    /**
     * Saca el vehículo de la lista de su dueño sin borrarlo.
     *
     * Es la salida al candado de `destroy()`: alguien que vendió el auto
     * necesita que deje de aparecerle, y el local necesita conservar los
     * servicios que le hizo. Poner `client_id` en null hace las dos: el
     * vehículo queda sin dueño conocido —que a partir de ahí es la verdad— y
     * sigue en Clientes como cualquier walk-in, con su historial entero.
     *
     * Mismo criterio que `clients:release-staff-owned`, que ya suelta así los
     * vehículos que colgaban del personal.
     */
    public function release(Request $request, string $id): JsonResponse
    {
        // El vehículo de otro cliente es un 404, no un 403: no se confirma que
        // ese id exista. `findOrFail` ya aplica el TenantScope.
        $resource = ClientResourceModel::findOrFail($id);

        if ($resource->client_id !== $request->user()?->id) {
            abort(404);
        }

        $resource->update(['client_id' => null]);

        return response()->json([
            'data' => ['message' => 'El vehículo salió de tu lista.'],
        ]);
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

    /**
     * La persona con ese nombre dentro del local, o una nueva.
     *
     * Empareja sin distinguir mayúsculas ni espacios de más: el emparejado
     * exacto convertía "Gaby Arellano", "gaby arellano" y "Gaby  Arellano" en
     * tres personas, y la deuda de sus autos quedaba partida entre las tres.
     * El nombre guardado sigue siendo el primero que se escribió — normalizar
     * para comparar no es reescribir lo que el mostrador ve.
     */
    private function findOrCreateClient(string $name, string $tenantId): UserModel
    {
        $name = trim(preg_replace('/\s+/u', ' ', $name) ?? $name);
        $buscado = mb_strtolower($name);

        $existing = UserModel::whereHas('tenants', function ($q) use ($tenantId) {
            $q->where('tenants.id', $tenantId)->where('tenant_users.role', 'client');
        })
            // En PHP y no en SQL: la comparación depende del collation de la
            // base —MySQL suele ignorar mayúsculas, SQLite no— y esa
            // diferencia no puede decidir si dos autos son de la misma persona.
            ->get()
            ->first(fn ($u) => mb_strtolower(trim(preg_replace('/\s+/u', ' ', $u->name) ?? $u->name)) === $buscado);

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
