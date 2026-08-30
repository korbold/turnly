<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Support;

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;

/**
 * Leer el negocio de la request sin que el contenedor decida el código HTTP.
 *
 * `ResolveTenantMiddleware` deja pasar la request cuando no resuelve el slug:
 * es a propósito, así la app del cliente pide sus cosas sin pertenecer a
 * ningún negocio. Pero los controladores del mismo grupo hacían
 * `app('current_tenant_id')` a pelo, y sin bindeo eso no es un 400 con
 * mensaje: es una BindingResolutionException, o sea un 500 que al cliente le
 * llega como "algo salió mal".
 *
 * Pasó en producción el 30-ago-2026. `EnsureTenantMemberMiddleware` ya leía
 * el binding con cuidado; esto es lo mismo, para los controladores que quedan
 * fuera de ese guardia.
 */
final class CurrentTenant
{
    /** El id, o null si esta request no trae negocio. */
    public static function idOrNull(): ?string
    {
        return app()->has('current_tenant_id') ? app('current_tenant_id') : null;
    }

    /**
     * El id, o corta con un 400 que se puede leer y arreglar desde el cliente.
     * Para las acciones que no significan nada sin un negocio.
     */
    public static function id(): string
    {
        $id = self::idOrNull();

        if ($id === null) {
            throw new HttpResponseException(new JsonResponse([
                'error' => [
                    'code' => 'TENANT_REQUIRED',
                    'message' => 'Falta indicar el negocio en la petición.',
                ],
            ], 400));
        }

        return $id;
    }
}
