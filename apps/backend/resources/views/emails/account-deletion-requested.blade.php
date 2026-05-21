<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Eliminación de cuenta</title></head>
<body style="font-family:sans-serif;color:#18181b;max-width:560px;margin:0 auto;padding:32px 16px">
  <p style="font-size:18px;font-weight:700;margin-bottom:8px">Hola, {{ $name }}</p>
  <p>Recibimos tu solicitud para eliminar tu cuenta de Turnly.</p>
  <p>Tu cuenta y datos personales se eliminarán permanentemente el <strong>{{ $deletesAt }}</strong>.</p>
  <p>Si cambias de mente, simplemente inicia sesión en la app antes de esa fecha y tu cuenta quedará restaurada automáticamente.</p>
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
  <p style="font-size:12px;color:#71717a">Si no reconoces esta acción, escríbenos a <a href="mailto:soporte@turnly.app">soporte@turnly.app</a>.</p>
  <p style="font-size:12px;color:#71717a">© {{ date('Y') }} Turnly · Ibarra, Ecuador</p>
</body>
</html>
