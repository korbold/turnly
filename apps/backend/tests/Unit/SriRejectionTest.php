<?php

use App\Domain\Billing\SriRejection;

/**
 * El SRI contesta con códigos genéricos y pone el motivo real en un campo
 * aparte. FEDER estuvo sin poder facturar y la pantalla sólo decía "ARCHIVO NO
 * CUMPLE ESTRUCTURA XML" — mientras el SRI había explicado, en
 * `informacionAdicional`, que el ambiente de la solicitud no coincidía con el
 * de ejecución. Ese campo se guardaba en el billing service y se tiraba acá.
 *
 * Diagnosticarlo costó entrar por SSH a producción. Con el campo a la vista
 * habría costado leer la pantalla.
 */
test('conserva el motivo real que el SRI puso aparte', function () {
    $inv = ['sri_response' => ['mensajes' => [[
        'identificador'   => '35',
        'mensaje'         => 'ARCHIVO NO CUMPLE ESTRUCTURA XML',
        'tipo'            => 'ERROR',
        'info_adicional'  => 'El ambiente de la solicitud PRODUCCIÓN no coincide con el de ejecución PRUEBAS',
    ]]]];

    $texto = SriRejection::describe($inv);

    expect($texto)->toContain('ARCHIVO NO CUMPLE ESTRUCTURA XML');
    expect($texto)->toContain('El ambiente de la solicitud PRODUCCIÓN no coincide');
});

test('sin info adicional devuelve sólo el mensaje', function () {
    $inv = ['sri_response' => ['mensajes' => [[
        'mensaje'        => 'ESTABLECIMIENTO CERRADO',
        'info_adicional' => '',
    ]]]];

    expect(SriRejection::describe($inv))->toBe('ESTABLECIMIENTO CERRADO');
});

test('no repite el texto cuando el SRI manda lo mismo en los dos campos', function () {
    $inv = ['sri_response' => ['mensajes' => [[
        'mensaje'        => 'CLAVE ACCESO REGISTRADA',
        'info_adicional' => 'CLAVE ACCESO REGISTRADA',
    ]]]];

    expect(SriRejection::describe($inv))->toBe('CLAVE ACCESO REGISTRADA');
});

test('lee también la forma sin envoltorio sri_response', function () {
    // El billing devuelve las dos formas según el endpoint.
    $inv = ['mensajes' => [[
        'mensaje'        => 'RUC NO EXISTE',
        'info_adicional' => 'Verifique el RUC del emisor',
    ]]];

    expect(SriRejection::describe($inv))->toContain('RUC NO EXISTE');
    expect(SriRejection::describe($inv))->toContain('Verifique el RUC del emisor');
});

test('sin mensajes devuelve null y no una cadena vacía', function () {
    // null deja que el llamador use su propio texto por defecto; "" haría
    // que la UI muestre una tarjeta de error en blanco.
    expect(SriRejection::describe([]))->toBeNull();
    expect(SriRejection::describe(['sri_response' => ['mensajes' => []]]))->toBeNull();
    expect(SriRejection::describe(['sri_response' => ['mensajes' => [['tipo' => 'ERROR']]]]))->toBeNull();
});
