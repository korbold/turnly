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
use Illuminate\Support\Facades\Http;

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

    public function showCert(): JsonResponse
    {
        $tenantId = app('current_tenant_id');
        $billingUrl = rtrim((string) config('services.billing.url'), '/');

        try {
            $response = Http::timeout(10)
                ->get("{$billingUrl}/api/tenant-billing-configs/{$tenantId}");

            if ($response->failed()) {
                return response()->json(['data' => null]);
            }

            return response()->json(['data' => $response->json('data', $response->json())]);
        } catch (\Throwable) {
            return response()->json(['data' => null]);
        }
    }

    public function uploadCert(Request $request): JsonResponse
    {
        $request->validate([
            'p12_file'               => ['required', 'file', 'max:500', 'mimetypes:application/x-pkcs12,application/octet-stream,application/pkcs12'],
            'p12_password'           => ['required', 'string'],
            'ambiente'               => ['required', 'integer', 'in:1,2'],
            'obligado_contabilidad'  => ['boolean'],
            'is_rimpe'               => ['boolean'],
        ]);

        $tenant = TenantModel::findOrFail(app('current_tenant_id'));

        if (empty($tenant->tax_id) || empty($tenant->legal_name)) {
            return response()->json([
                'message' => 'Completa los datos del emisor (RUC y razón social) antes de subir el certificado.',
            ], 422);
        }

        $p12Base64 = base64_encode(file_get_contents($request->file('p12_file')->path()));

        $billingUrl = rtrim((string) config('services.billing.url'), '/');

        $payload = [
            'tenant_id'              => $tenant->id,
            'ruc'                    => $tenant->tax_id,
            'razon_social'           => $tenant->legal_name,
            'dir_matriz'             => $tenant->billing_address,
            'p12_cert'               => $p12Base64,
            'p12_password'           => $request->input('p12_password'),
            'ambiente'               => (int) $request->input('ambiente'),
            'obligado_contabilidad'  => (bool) $request->boolean('obligado_contabilidad', false),
            'is_rimpe'               => (bool) $request->boolean('is_rimpe', false),
        ];

        try {
            $response = Http::timeout(20)
                ->post("{$billingUrl}/api/tenant-billing-configs", $payload);

            if ($response->failed()) {
                $errorMessage = $response->json('message') ?? $response->body();

                return response()->json(['message' => $errorMessage], 422);
            }

            return response()->json(['data' => $response->json('data', $response->json())]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
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
