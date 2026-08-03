<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Restablece tu contraseña de Turnly</title>
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
          Restablece tu contraseña
        </h1>
        <p style="color:#4B5462; line-height:1.55; font-size:15px; margin:0 0 24px;">
          Hola{{ $name ? ' ' . $name : '' }}, recibimos una solicitud para restablecer la contraseña de tu negocio en Turnly. Toca el botón para crear una nueva.
        </p>

        <table align="center" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
          <tr>
            <td align="center" style="border-radius:10px; background:#F2693A;">
              <a href="{{ $resetUrl }}"
                 style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:10px;">
                Restablecer contraseña
              </a>
            </td>
          </tr>
        </table>

        <p style="color:#6B7280; font-size:13px; line-height:1.5; margin:0 0 16px;">
          ¿El botón no funciona? Copia y pega este link en tu navegador:
        </p>
        <p style="word-break:break-all; font-size:12px; color:#4B5462; background:#F4F5F7; padding:12px; border-radius:8px; margin:0 0 24px; font-family: ui-monospace, SFMono-Regular, monospace;">
          {{ $resetUrl }}
        </p>

        <p style="color:#8B92A0; font-size:13px; line-height:1.5; margin:0;">
          El link expira en {{ $ttlMinutes }} minutos. Si no solicitaste esto, ignora este correo — tu contraseña no cambiará.
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
