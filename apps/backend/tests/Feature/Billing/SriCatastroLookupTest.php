<?php

declare(strict_types=1);

use App\Application\Services\SriLookupService;
use App\Infrastructure\Persistence\Models\SriTaxpayerModel;

it('resuelve la razón social desde el catastro local', function () {
    SriTaxpayerModel::create([
        'tax_id' => '1003249263001',
        'legal_name' => 'PASPUEL VILLARREAL SEGUNDO FEDERMAN',
        'accounting_required' => false,
        'withholding_agent' => false,
        'special_taxpayer' => false,
    ]);

    $result = app(SriLookupService::class)->lookup('1003249263001');

    expect($result)->not->toBeNull()
        ->and($result['razon_social'])->toBe('PASPUEL VILLARREAL SEGUNDO FEDERMAN');
});
