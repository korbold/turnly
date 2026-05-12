<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Código de verificación Turnly</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f4f4f7; margin:0; padding:24px;">
  <table align="center" width="100%" style="max-width:520px; background:#ffffff; border-radius:12px; padding:32px;" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td>
        <h1 style="font-size:20px; color:#111827; margin:0 0 16px;">Hola {{ $name }},</h1>
        <p style="color:#374151; line-height:1.5; margin:0 0 24px;">
          Usa este código para verificar tu cuenta en Turnly:
        </p>
        <div style="background:#eef2ff; border-radius:8px; padding:20px; text-align:center; margin:0 0 24px;">
          <span style="font-size:32px; letter-spacing:8px; font-weight:700; color:#4338ca;">{{ $code }}</span>
        </div>
        <p style="color:#6b7280; font-size:14px; line-height:1.5; margin:0 0 8px;">
          El código expira en {{ $ttlMinutes }} minutos. Si no solicitaste esta verificación, ignora este correo.
        </p>
        <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">
          Turnly · goturnly.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
