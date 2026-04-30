<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Tenant;

use App\Application\Services\SriLookupService;
use App\Domain\Shared\Identification\EcIdValidator;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Tenant\UpdateBillingProfileRequest;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingProfileController extends Controller
{
    public function __construct(private SriLookupService $sriLookup) {}

    public function show(): JsonResponse
    {
        $tenant = TenantModel::findOrFail(app('current_tenant_id'));

        return response()->json([
            'data' => $this->serialize($tenant),
        ]);
    }

    public function update(UpdateBillingProfileRequest $request): JsonResponse
    {
        $tenant = TenantModel::findOrFail(app('current_tenant_id'));

        $payload = $request->validated();

        $verified = false;
        $verifiedAt = null;
        if ($payload['tax_id_type'] !== 'pasaporte') {
            $lookup = $this->sriLookup->lookup($payload['tax_id']);
            if ($lookup !== null && strtoupper($lookup['estado']) === 'ACTIVO') {
                $verified = true;
                $verifiedAt = now();
            }
        }

        $tenant->update($payload + [
            'billing_verified' => $verified,
            'billing_verified_at' => $verifiedAt,
        ]);

        return response()->json([
            'data' => $this->serialize($tenant->fresh()),
        ]);
    }

    public function lookup(Request $request): JsonResponse
    {
        $request->validate([
            'tax_id_type' => ['required', 'string', 'in:ruc,cedula,pasaporte'],
            'tax_id' => ['required', 'string', 'max:20'],
        ]);

        $type = (string) $request->input('tax_id_type');
        $taxId = (string) $request->input('tax_id');

        if (!EcIdValidator::validate($type, $taxId)) {
            return response()->json([
                'data' => [
                    'format_valid' => false,
                    'lookup' => null,
                ],
            ]);
        }

        $lookup = $type === 'pasaporte' ? null : $this->sriLookup->lookup($taxId);

        return response()->json([
            'data' => [
                'format_valid' => true,
                'lookup' => $lookup,
            ],
        ]);
    }

    private function serialize(TenantModel $tenant): array
    {
        return [
            'tax_id_type' => $tenant->tax_id_type,
            'tax_id' => $tenant->tax_id,
            'legal_name' => $tenant->legal_name,
            'billing_email' => $tenant->billing_email,
            'billing_address' => $tenant->billing_address,
            'billing_phone' => $tenant->billing_phone,
            'billing_verified' => (bool) $tenant->billing_verified,
            'billing_verified_at' => $tenant->billing_verified_at?->toIso8601String(),
        ];
    }
}
