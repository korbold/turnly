<?php

use App\Domain\Tenant\StaffPrivileges;

test('the cashier may work the drawer by default', function () {
    // A diferencia de Precio y Eliminar: abrir y cerrar la caja ES el trabajo
    // del cajero. Un default en 'none' desplegaría la feature apagada.
    expect(StaffPrivileges::granted('cashier', StaffPrivileges::CASH, []))->toBeTrue();
});

test('the admin may work the drawer by default', function () {
    expect(StaffPrivileges::granted('tenant_admin', StaffPrivileges::CASH, []))->toBeTrue();
});

test('the washer may not', function () {
    expect(StaffPrivileges::granted('washer', StaffPrivileges::CASH, []))->toBeFalse();
});

test('the owner is never gated out of their own drawer', function () {
    expect(StaffPrivileges::granted('owner', StaffPrivileges::CASH, ['Admin' => ['Caja' => 'none']]))
        ->toBeTrue();
});

test('the matrix can take the drawer away from the cashier', function () {
    expect(StaffPrivileges::granted('cashier', StaffPrivileges::CASH, ['Cajero' => ['Caja' => 'none']]))
        ->toBeFalse();
});
