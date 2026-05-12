<?php

declare(strict_types=1);

namespace App\Application\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Best-effort lookup against the SRI public mobile endpoint to confirm a
 * RUC/cedula exists and fetch its razón social. Always degrades gracefully:
 * any network/parse failure returns null so callers can fall back to manual
 * data entry.
 */
final class SriLookupService
{
    private const ENDPOINT = 'https://srienlinea.sri.gob.ec/movil-servicios/api/v1.0/deudas/porIdentificacion/';
    private const TIMEOUT_SECONDS = 5;

    /**
     * @return array{razon_social:string,estado:string,tipo_identificacion:string}|null
     */
    public function lookup(string $taxId): ?array
    {
        $taxId = trim($taxId);
        if ($taxId === '') {
            return null;
        }

        try {
            $response = Http::timeout(self::TIMEOUT_SECONDS)
                ->acceptJson()
                ->get(self::ENDPOINT . $taxId);

            if (!$response->successful()) {
                return null;
            }

            $body = $response->json();
            $contribuyente = $body['contribuyente'] ?? null;
            if (!is_array($contribuyente)) {
                return null;
            }

            $razon = $contribuyente['nombreComercial']
                ?? $contribuyente['razonSocial']
                ?? null;

            if (!is_string($razon) || $razon === '') {
                return null;
            }

            return [
                'razon_social' => $razon,
                'estado' => (string) ($contribuyente['estadoContribuyenteRuc']
                    ?? $contribuyente['estado']
                    ?? 'DESCONOCIDO'),
                'tipo_identificacion' => (string) ($contribuyente['tipoIdentificacion'] ?? ''),
            ];
        } catch (Throwable $e) {
            Log::warning('SRI lookup failed', ['tax_id' => $taxId, 'error' => $e->getMessage()]);
            return null;
        }
    }
}
