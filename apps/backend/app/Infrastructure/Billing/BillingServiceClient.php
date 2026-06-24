<?php

declare(strict_types=1);

namespace App\Infrastructure\Billing;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class BillingServiceClient
{
    private string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) config('services.billing.url'), '/');
    }

    public function emitInvoice(array $data): array
    {
        try {
            $response = Http::timeout(15)
                ->post("{$this->baseUrl}/api/invoices", $data)
                ->throw();

            return $response->json('data', $response->json() ?? []);
        } catch (RequestException $e) {
            throw new RuntimeException(
                'Billing service error: ' . $e->response->body(),
                $e->getCode(),
                $e
            );
        }
    }

    public function getInvoice(string $id): array
    {
        try {
            $response = Http::timeout(10)
                ->get("{$this->baseUrl}/api/invoices/{$id}")
                ->throw();

            return $response->json('data', $response->json() ?? []);
        } catch (RequestException $e) {
            throw new RuntimeException(
                'Billing service error: ' . $e->response->body(),
                $e->getCode(),
                $e
            );
        }
    }
}
