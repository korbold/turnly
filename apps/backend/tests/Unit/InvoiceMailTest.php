<?php

use App\Infrastructure\Mail\InvoiceMail;

test('subject names the emitting business', function () {
    $mail = new InvoiceMail(
        clientEmail: 'cliente@example.com',
        externalInvoiceId: 'inv-123',
        invoiceNumber: '3007202601...710',
        issuedAt: '30/07/2026',
        businessName: 'Negocio de pruebas',
    );

    expect($mail->envelope()->subject)->toBe('Tu factura emitida por Negocio de pruebas');
});
