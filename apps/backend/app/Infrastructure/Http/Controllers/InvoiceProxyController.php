<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers;

use App\Infrastructure\Billing\BillingServiceClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;

class InvoiceProxyController extends Controller
{
    public function __construct(private readonly BillingServiceClient $billing) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = app('current_tenant_id');

        $filters = array_filter([
            'status'    => $request->query('status'),
            'date_from' => $request->query('date_from'),
            'date_to'   => $request->query('date_to'),
            'per_page'  => $request->query('per_page'),
            'page'      => $request->query('page'),
        ], fn ($v) => $v !== null);

        $result = $this->billing->getInvoices($tenantId, $filters);

        return response()->json($result);
    }

    public function ride(string $id): Response
    {
        $pdf = $this->billing->getInvoiceRide($id);

        return response($pdf, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"factura-{$id}.pdf\"",
        ]);
    }
}
