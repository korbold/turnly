<?php

use App\Domain\Identity\EcuadorIdValidator;

test('valid cedula passes mod-10 check', function () {
    expect(EcuadorIdValidator::isCedula('1710034065'))->toBeTrue();
});

test('cedula with wrong checksum fails', function () {
    expect(EcuadorIdValidator::isCedula('1710034066'))->toBeFalse();
});

test('cedula must be 10 digits', function () {
    expect(EcuadorIdValidator::isCedula('171003406'))->toBeFalse();
    expect(EcuadorIdValidator::isCedula('17100340650'))->toBeFalse();
    expect(EcuadorIdValidator::isCedula('abcdefghij'))->toBeFalse();
});

test('valid natural-person RUC is 10-digit cedula plus 001', function () {
    expect(EcuadorIdValidator::isRuc('1710034065001'))->toBeTrue();
});

test('RUC requires non-zero establishment suffix', function () {
    expect(EcuadorIdValidator::isRuc('1710034065000'))->toBeFalse();
});

test('RUC with non-13 length fails', function () {
    expect(EcuadorIdValidator::isRuc('171003406500'))->toBeFalse();
});
