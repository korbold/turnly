<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Tu cita en {{ $tenantName }}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#FAFAFB; margin:0; padding:24px; color:#2E3441;">
  <table align="center" width="100%" style="max-width:520px;" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding:0 0 20px;">
        <table cellspacing="0" cellpadding="0" border="0" style="width:auto;">
          <tr>
            <td style="background:#F2693A; width:36px; height:36px; border-radius:8px; vertical-align:middle; text-align:center; font-weight:800; color:#FFFFFF; font-size:16px;">T</td>
            <td style="padding-left:10px; vertical-align:middle; font-size:18px; font-weight:700; color:#0E121A; letter-spacing:-0.01em;">Turnly</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#FFFFFF; border:1px solid #E4E7EC; border-radius:16px; padding:32px;">

        <p style="color:#6B7280; font-size:13px; margin:0 0 6px; text-transform:uppercase; letter-spacing:0.06em; font-weight:600;">
          {{ $tenantName }}
        </p>
        <h1 style="font-size:24px; font-weight:700; color:#0E121A; margin:0 0 4px; letter-spacing:-0.01em;">
          {{ $when }}
        </h1>
        <p style="color:#4B5462; line-height:1.55; font-size:15px; margin:0 0 24px;">
          {{ $servicesLabel }} · {{ $durationMin }} min
        </p>

        @if ($isConfirmed)
          <p style="background:#E9F7EF; color:#0B6E3D; font-size:14px; line-height:1.5; margin:0 0 24px; padding:12px 14px; border-radius:10px;">
            Tu cita está confirmada. Te esperamos.
          </p>
        @else
          <p style="background:#FDF3E3; color:#8A5A10; font-size:14px; line-height:1.5; margin:0 0 24px; padding:12px 14px; border-radius:10px;">
            {{ $tenantName }} todavía tiene que confirmar la cita. Te avisamos apenas lo haga.
          </p>
        @endif

        <table align="center" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
          <tr>
            <td align="center" style="border-radius:10px; background:#F2693A;">
              <a href="{{ $magicUrl }}"
                 style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:10px;">
                Ver mi cita
              </a>
            </td>
          </tr>
        </table>

        <p style="color:#6B7280; font-size:13px; line-height:1.5; margin:0 0 24px; text-align:center;">
          Desde ahí la puedes ver o cancelar. No necesitas contraseña.
        </p>

        @if ($address || $phone)
          <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #E4E7EC; padding-top:20px;">
            @if ($address)
              <tr>
                <td style="padding:16px 0 0; color:#6B7280; font-size:13px;">Dónde</td>
                <td style="padding:16px 0 0; color:#2E3441; font-size:13px; text-align:right; font-weight:600;">{{ $address }}</td>
              </tr>
            @endif
            @if ($phone)
              <tr>
                <td style="padding:8px 0 0; color:#6B7280; font-size:13px;">Teléfono</td>
                <td style="padding:8px 0 0; color:#2E3441; font-size:13px; text-align:right; font-weight:600;">{{ $phone }}</td>
              </tr>
            @endif
          </table>
        @endif

      </td>
    </tr>
    <tr>
      <td style="padding:20px 4px; color:#8B92A0; font-size:12px; line-height:1.5;">
        {{-- Sin directiva: un @if pegado a la palabra anterior no lo compila
             Blade, se queda como texto y su @endif rompe la vista entera. --}}
        ¿No reservaste esto? Alguien escribió tu correo por error. No toques el botón{{ $phone ? " y avisa a {$tenantName} al {$phone}" : '' }}.
        <br>Turnly · goturnly.com
      </td>
    </tr>
  </table>
</body>
</html>
