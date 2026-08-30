Tu cita en {{ $tenantName }}

{{ $when }}
{{ $servicesLabel }} · {{ $durationMin }} min

@if ($isConfirmed)
Tu cita esta confirmada. Te esperamos.
@else
{{ $tenantName }} todavia tiene que confirmar la cita. Te avisamos apenas lo haga.
@endif

Ver o cancelar tu cita (no necesitas contrasena):
{{ $magicUrl }}
@if ($address)

Donde: {{ $address }}
@endif
@if ($phone)
Telefono: {{ $phone }}
@endif

No reservaste esto? Alguien escribio tu correo por error. No toques el link{{ $phone ? " y avisa a {$tenantName} al {$phone}" : '' }}.

--
Turnly · goturnly.com
