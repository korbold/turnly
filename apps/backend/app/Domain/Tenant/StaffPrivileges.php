<?php

namespace App\Domain\Tenant;

/**
 * The permissions matrix (tenant.settings.permissions) grants sections — can
 * this role open Registro, Reportes, Config. A privilege is the other axis:
 * what the role may do once inside a section it can already open. Naming the
 * price of a service and erasing a row from the day are the two that move
 * money, so they are granted explicitly rather than implied by the role.
 *
 * Both columns default to Admin-only, which is exactly the behaviour that
 * shipped hard-coded — a tenant whose matrix predates them keeps it. A third
 * privilege, Asignados, governs who may set the washer/dryer on a service
 * log while it is still `in_progress` (defaults: Admin and Cajero). It only
 * governs that in-progress window — correcting the assignees once a log is
 * `completed` is a fixed owner/tenant_admin-only rule that deliberately does
 * NOT go through this matrix; see ServiceLogController::updateAssignees.
 *
 * Mirrors the admin's PRIVILEGES / DEFAULT_PERMISSIONS / ROLE_TO_MATRIX. The
 * keys are display names because that is what the editor persists; they are
 * frozen in tenants' settings JSON and must not be renamed.
 */
final class StaffPrivileges
{
    public const PRICE     = 'Precio';
    public const DELETE    = 'Eliminar';
    public const ASSIGNEES = 'Asignados';

    private const ROLE_TO_MATRIX = [
        'tenant_admin' => 'Admin',
        'cashier'      => 'Cajero',
        'washer'       => 'Lavador',
        'client'       => 'Cliente',
    ];

    private const DEFAULTS = [
        'Admin'   => [self::PRICE => 'full', self::DELETE => 'full', self::ASSIGNEES => 'full'],
        'Cajero'  => [self::PRICE => 'none', self::DELETE => 'none', self::ASSIGNEES => 'full'],
        'Lavador' => [self::PRICE => 'none', self::DELETE => 'none', self::ASSIGNEES => 'none'],
        'Cliente' => [self::PRICE => 'none', self::DELETE => 'none', self::ASSIGNEES => 'none'],
    ];

    /**
     * @param  string|null  $role         the caller's role inside this tenant
     * @param  array|null   $permissions  tenant.settings['permissions'], as stored
     */
    public static function granted(?string $role, string $privilege, ?array $permissions): bool
    {
        // The owner is never gated out of their own shop, and has no row in
        // the matrix to be gated by.
        if ($role === 'owner') {
            return true;
        }

        $matrixKey = self::ROLE_TO_MATRIX[$role] ?? null;
        if ($matrixKey === null) {
            return false;
        }

        $granted = $permissions[$matrixKey][$privilege]
            ?? self::DEFAULTS[$matrixKey][$privilege]
            ?? 'none';

        return $granted === 'full';
    }
}
