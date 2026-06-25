<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Tu factura electrónica</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#FAFAFB; margin:0; padding:24px; color:#2E3441;">
  <table align="center" width="100%" style="max-width:520px;" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding:0 0 20px;">
        <table cellspacing="0" cellpadding="0" border="0" style="width:auto;">
          <tr>
            <td style="background:#F2693A; width:36px; height:36px; border-radius:8px; vertical-align:middle; text-align:center; font-weight:800; color:#FFFFFF; font-size:16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">T</td>
            <td style="padding-left:10px; vertical-align:middle; font-size:18px; font-weight:700; color:#0E121A; letter-spacing:-0.01em;">Turnly</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#FFFFFF; border:1px solid #E4E7EC; border-radius:16px; padding:32px;">
        <h1 style="font-size:22px; font-weight:700; color:#0E121A; margin:0 0 12px; letter-spacing:-0.01em;">
          Tu factura electrónica
        </h1>
        <p style="color:#4B5462; line-height:1.55; font-size:15px; margin:0 0 16px;">
          Adjuntamos tu factura electrónica autorizada por el SRI.
        </p>
        <table style="width:100%; background:#F4F5F7; border-radius:10px; padding:16px; margin-bottom:20px;" cellspacing="0" cellpadding="0">
          <tr>
            <td style="font-size:13px; color:#6B7280; padding-bottom:6px;">Número de factura</td>
            <td style="font-size:13px; color:#0E121A; font-weight:600; text-align:right;">{{ $invoiceNumber }}</td>
          </tr>
          <tr>
            <td style="font-size:13px; color:#6B7280;">Fecha de emisión</td>
            <td style="font-size:13px; color:#0E121A; font-weight:600; text-align:right;">{{ $issuedAt }}</td>
          </tr>
        </table>
        <p style="color:#8B92A0; font-size:13px; line-height:1.5; margin:0;">
          Si tienes dudas sobre esta factura, contacta al negocio que te prestó el servicio.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 0 0; text-align:center; color:#8B92A0; font-size:12px;">
        Turnly · goturnly.com
      </td>
    </tr>
  </table>
</body>
</html>
