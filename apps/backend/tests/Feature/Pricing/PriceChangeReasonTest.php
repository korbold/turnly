<?php
// apps/backend/tests/Feature/Pricing/PriceChangeReasonTest.php

use App\Domain\Pricing\PriceChangeReason;
use Illuminate\Support\Facades\Schema;

test('the reason list is closed and every code has a label', function () {
    // Texto libre se degrada a "descuento", "x", "asd" en un mes y deja el
    // reporte sin agrupar. La lista cerrada es el punto de la feature.
    expect(PriceChangeReason::CODES)->toBe([
        'cliente_frecuente', 'promocion', 'cortesia', 'acordado', 'otro',
    ]);

    foreach (PriceChangeReason::CODES as $code) {
        expect(PriceChangeReason::LABELS[$code] ?? null)->toBeString();
    }
});

test('only otro demands a written note', function () {
    // Si el 70% cae en "otro", la lista está mal — y el reporte lo dice solo.
    expect(PriceChangeReason::REQUIRES_NOTE)->toBe('otro');
});

test('an unknown code is not valid', function () {
    expect(PriceChangeReason::isValid('cliente_frecuente'))->toBeTrue();
    expect(PriceChangeReason::isValid('cliente_especial'))->toBeFalse();
    expect(PriceChangeReason::isValid(null))->toBeFalse();
});

test('the columns exist', function () {
    expect(Schema::hasColumn('service_log_items', 'catalog_price'))->toBeTrue();
    expect(Schema::hasColumn('service_logs', 'price_change_reason'))->toBeTrue();
    expect(Schema::hasColumn('service_logs', 'price_change_note'))->toBeTrue();
    expect(Schema::hasColumn('reservation_item_changes', 'reason_code'))->toBeTrue();
});
