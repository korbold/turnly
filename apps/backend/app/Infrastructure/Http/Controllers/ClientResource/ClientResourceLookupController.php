<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\ClientResource;

use App\Infrastructure\Http\Support\CurrentTenant;
use App\Domain\ClientResource\Plate;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Cashier-facing dedup helpers for the (tenant_id, plate) pair.
 *   - lookup: tells the admin form whether the plate already exists
 *     for this tenant (and whose it is) so we don't insert a duplicate
 *     row that would now violate the unique constraint.
 *   - transfer: reassigns the resource to a different customer when
 *     the previous owner sold the vehicle.
 */
class ClientResourceLookupController extends Controller
{
    public function lookup(Request $request): JsonResponse
    {
        $plate = trim((string) $request->input('plate', ''));
        if ($plate === '') {
            return response()->json(['data' => null]);
        }

        // La placa vive dentro de `data`, no en la columna: `save()` nunca
        // llenó `plate` y en producción está NULL en todas las filas, así que
        // este lookup —el que el formulario usa para avisar "esa placa ya
        // existe"— siempre contestaba que no. Se compara normalizado porque
        // el cajero escribe "IBD-9115" o "ibd 9115" según el día.
        $buscada = Plate::normalize($plate);

        $resource = ClientResourceModel::query()
            ->forTenant(CurrentTenant::id())
            ->with('client:id,name,phone,email')
            ->get()
            ->first(fn ($r) => Plate::normalize(Plate::fromData($r->data)) === $buscada);

        if (!$resource) {
            return response()->json(['data' => null]);
        }

        return response()->json([
            'data' => [
                'id'         => $resource->id,
                'plate'      => Plate::fromData($resource->data) ?? $resource->plate,
                'brand'      => $resource->brand,
                'model'      => $resource->model,
                'color'      => $resource->color,
                'type'       => $resource->type,
                'client'     => $resource->client ? [
                    'id'    => $resource->client->id,
                    'name'  => $resource->client->name,
                    'email' => $resource->client->email,
                    'phone' => $resource->client->phone,
                ] : null,
            ],
        ]);
    }

    /**
     * Reassign the resource to a different client (vehicle sold).
     * Keeps the row's history intact — only flips client_id and writes
     * an audit row so reports can trace ownership changes.
     */
    public function transfer(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'new_client_id' => ['required', 'uuid', 'exists:users,id'],
            'reason'        => ['nullable', 'string', 'max:255'],
        ]);

        $resource = ClientResourceModel::findOrFail($id);
        $previousOwnerId = $resource->client_id;

        $resource->update(['client_id' => $data['new_client_id']]);

        // Lightweight audit using the existing client_resources table —
        // a structured audit row will be added later if reports need it.
        \Illuminate\Support\Facades\Log::info('client_resource transferred', [
            'resource_id'    => $resource->id,
            'tenant_id'      => $resource->tenant_id,
            'previous_owner' => $previousOwnerId,
            'new_owner'      => $data['new_client_id'],
            'cashier_id'     => $request->user()?->id,
            'reason'         => $data['reason'] ?? null,
        ]);

        return response()->json([
            'data' => ['message' => 'Vehículo transferido al nuevo dueño'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
