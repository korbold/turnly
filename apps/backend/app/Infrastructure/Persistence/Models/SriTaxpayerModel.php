<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One row per RUC from the SRI's public catastro. Not tenant-scoped —
 * the registry is national and shared by every tenant.
 */
class SriTaxpayerModel extends Model
{
    protected $table = 'sri_taxpayers';

    protected $primaryKey = 'tax_id';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'tax_id', 'legal_name', 'accounting_required',
        'withholding_agent', 'special_taxpayer', 'province', 'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'accounting_required' => 'boolean',
            'withholding_agent' => 'boolean',
            'special_taxpayer' => 'boolean',
            'synced_at' => 'datetime',
        ];
    }
}
