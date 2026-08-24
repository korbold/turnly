<?php

use App\Infrastructure\Http\Controllers\Cash\CashSessionController;
use App\Infrastructure\Http\Controllers\Debt\DebtController;
use App\Infrastructure\Http\Controllers\Auth\AuthController;
use App\Infrastructure\Http\Controllers\Auth\GoogleAuthController;
use App\Infrastructure\Http\Controllers\Auth\MagicLinkController;
use App\Infrastructure\Http\Controllers\Auth\OnboardingController;
use App\Infrastructure\Http\Controllers\Tenant\TenantSettingsController;
use App\Infrastructure\Http\Controllers\Tenant\TenantImageController;
use App\Infrastructure\Http\Controllers\Reservation\ReservationController;
use App\Infrastructure\Http\Controllers\Reservation\ReservationCheckInController;
use App\Infrastructure\Http\Controllers\Reservation\ReservationItemController;
use App\Infrastructure\Http\Controllers\Reservation\ClientReservationItemController;
use App\Infrastructure\Http\Controllers\Client\ClientSearchController;
use App\Infrastructure\Http\Controllers\Auth\ClaimController;
use App\Infrastructure\Http\Controllers\ClientResource\ClientResourceLookupController;
use App\Infrastructure\Http\Controllers\Billing\UserBillingProfileController;
use App\Infrastructure\Http\Controllers\ServiceLog\ServiceLogController;
use App\Infrastructure\Http\Controllers\ServiceStaff\ServiceStaffController;
use App\Infrastructure\Http\Controllers\ClientResource\ClientResourceController;
use App\Infrastructure\Http\Controllers\BusinessResource\BusinessResourceController;
use App\Infrastructure\Http\Controllers\Service\ServiceController;
use App\Infrastructure\Http\Controllers\Service\ServiceVariantController;
use App\Infrastructure\Http\Controllers\Service\BomController;
use App\Infrastructure\Http\Controllers\Inventory\ProductController;
use App\Infrastructure\Http\Controllers\Inventory\StockMovementController;
use App\Infrastructure\Http\Controllers\User\UserController;
use App\Infrastructure\Http\Controllers\Report\ReportController;
use App\Infrastructure\Http\Controllers\SuperAdmin\SuperAdminController;
use App\Infrastructure\Http\Controllers\Upload\UploadController;
use App\Infrastructure\Http\Controllers\PublicController;
use App\Infrastructure\Http\Controllers\InvoiceProxyController;
use Illuminate\Support\Facades\Route;

// Public business pages
Route::prefix('v1/public')->group(function () {
    Route::get('plans', [PublicController::class, 'listPlans']);
    Route::get('legal/{type}', [\App\Infrastructure\Http\Controllers\LegalController::class, 'show']);
    Route::get('categories', [PublicController::class, 'listCategories']);
    Route::get('tenants', [PublicController::class, 'listTenants']);
    Route::get('tenants/{slug}', [PublicController::class, 'getTenant']);
    Route::get('tenants/{slug}/available-slots', [PublicController::class, 'getAvailableSlots']);
    Route::get('services/{id}/suggested-variant', [PublicController::class, 'suggestVariant'])->middleware('auth:sanctum');
    Route::get('tenants/{slug}/my-resources', [PublicController::class, 'myResources'])->middleware('auth:sanctum');
    Route::post('tenants/{slug}/book', [PublicController::class, 'book'])
        ->middleware(['throttle:public-book', 'turnstile']);
});

Route::prefix('v1')->group(function () {

    // Public auth
    // Account claim flow (no SMS — magic link + QR/PIN only).
    Route::post('auth/lookup', [ClaimController::class, 'lookup'])->middleware('throttle:30,1');
    Route::post('auth/claim/start', [ClaimController::class, 'start'])->middleware('throttle:10,60');
    Route::post('auth/claim/verify', [ClaimController::class, 'verify'])->middleware('throttle:10,60');

    Route::post('auth/register', [AuthController::class, 'register'])
        ->middleware('throttle:5,60');
    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:login');
    Route::post('auth/google', [GoogleAuthController::class, 'login'])
        ->middleware('throttle:google-auth');
    Route::post('auth/magic-link/request', [MagicLinkController::class, 'request'])
        ->middleware(['throttle:magic-link-email', 'throttle:magic-link-global', 'turnstile']);
    Route::post('auth/magic-link/verify', [MagicLinkController::class, 'verify'])
        ->middleware('throttle:10,60');
    Route::post('auth/verify-email', [AuthController::class, 'verifyEmail'])
        ->middleware('throttle:10,60');
    Route::post('auth/verify-email/resend', [AuthController::class, 'resendVerification'])
        ->middleware('throttle:5,60');
    Route::post('auth/password/forgot', [AuthController::class, 'forgotPassword'])
        ->middleware('throttle:5,60');
    Route::post('auth/password/reset', [AuthController::class, 'resetPassword'])
        ->middleware('throttle:10,60');

    // Public onboarding
    Route::prefix('onboarding')->group(function () {
        Route::post('register', [OnboardingController::class, 'register'])
            ->middleware('throttle:onboarding-register');
        Route::post('verify', [OnboardingController::class, 'verify'])
            ->middleware('throttle:10,60');
        Route::get('check-slug', [OnboardingController::class, 'checkSlug'])
            ->middleware('throttle:30,1');
    });

    // Authenticated routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/accept-terms', [AuthController::class, 'acceptTerms']);
        Route::delete('auth/account', [AuthController::class, 'requestDeletion']);

        // Authenticated onboarding (no tenant middleware — tenant resolved from user)
        Route::post('onboarding/business-type', [OnboardingController::class, 'setBusinessType'])
            ->middleware('verified.email');

        // Client-facing routes (no tenant middleware — returns data across all tenants for the authenticated user)
        Route::get('client/reservations', [ReservationController::class, 'myReservations']);
        Route::get('client/reservations/{id}', [ReservationController::class, 'myReservationShow']);
        Route::patch('client/reservations/{id}/cancel', [ReservationController::class, 'myReservationCancel']);
        Route::patch('client/reservations/{id}/reschedule', [ReservationController::class, 'myReservationReschedule']);

        // Phase 3.5 — customer can edit pending/confirmed reservations.
        Route::get('client/reservations/{id}/items', [ClientReservationItemController::class, 'index']);
        Route::post('client/reservations/{id}/items', [ClientReservationItemController::class, 'store']);
        Route::delete('client/reservation-items/{id}', [ClientReservationItemController::class, 'destroy']);

        // Device tokens (tenant middleware tolerates no-slug for client app)
        Route::middleware('tenant')->group(function () {
            Route::post('device-tokens', [\App\Infrastructure\Http\Controllers\Notification\DeviceTokenController::class, 'store']);
            Route::delete('device-tokens/{token}', [\App\Infrastructure\Http\Controllers\Notification\DeviceTokenController::class, 'destroy']);
        });

        // Customer booking flow (tenant-scoped, email verification NOT required).
        // The booking action itself (/public/tenants/{slug}/book) is public, so
        // its supporting reads/writes must not be gated stricter than the action
        // they serve. Gating these behind verified.email silently tore down the
        // mobile booking screen for any customer whose email_verified_at was null.
        Route::middleware('tenant')->group(function () {
            Route::get('reservations/available-slots', [ReservationController::class, 'availableSlots']);

            Route::get('client-resources', [ClientResourceController::class, 'index']);
            Route::post('client-resources', [ClientResourceController::class, 'store']);
            // Antes de `{id}`, o Laravel matchea "lookup" como si fuera un id
            // y devuelve 404. Así estuvo: el aviso de placa duplicada del
            // formulario nunca llegó a ejecutarse.
            Route::get('client-resources/lookup', [ClientResourceLookupController::class, 'lookup']);
            Route::get('client-resources/{id}', [ClientResourceController::class, 'show']);
            Route::patch('client-resources/{id}', [ClientResourceController::class, 'update']);
            Route::delete('client-resources/{id}', [ClientResourceController::class, 'destroy']);
            Route::get('client-resources/{id}/history', [ClientResourceController::class, 'history']);
            // Deuda de una placa: de qué está hecha y qué se le pagó.
            Route::get('client-resources/{id}/debt', [DebtController::class, 'show']);
            // Fiscal data: view / edit the client's default billing profile.
            Route::get('client-resources/{id}/billing', [ClientResourceController::class, 'showBilling']);
            Route::put('client-resources/{id}/billing', [ClientResourceController::class, 'updateBilling']);
        });

        // Billing profiles (customer-facing, not tenant scoped).
        Route::get('billing-profiles', [UserBillingProfileController::class, 'index']);
        Route::post('billing-profiles', [UserBillingProfileController::class, 'store']);
        Route::patch('billing-profiles/{id}', [UserBillingProfileController::class, 'update']);
        Route::patch('billing-profiles/{id}/default', [UserBillingProfileController::class, 'setDefault']);
        Route::delete('billing-profiles/{id}', [UserBillingProfileController::class, 'destroy']);

        // Notifications inbox
        Route::get('notifications', [\App\Infrastructure\Http\Controllers\Notification\NotificationController::class, 'index']);
        Route::post('notifications/read-all', [\App\Infrastructure\Http\Controllers\Notification\NotificationController::class, 'markAllAsRead']);
        Route::post('notifications/{id}/read', [\App\Infrastructure\Http\Controllers\Notification\NotificationController::class, 'markAsRead']);

        // auth/me stays unguarded: the customer app calls it pre-booking,
        // and me() deliberately tolerates a non-member (returns tenant: null).
        Route::middleware(['verified.email', 'tenant'])->group(function () {
            Route::get('auth/me', [AuthController::class, 'me']);
        });

        // Tenant-scoped routes (require verified email + active tenant membership)
        Route::middleware(['verified.email', 'tenant', 'tenant.member'])->group(function () {
            // Tenant settings
            Route::get('tenant/settings', [TenantSettingsController::class, 'show']);
            Route::patch('tenant/settings', [TenantSettingsController::class, 'update']);

            // Tenant plan + usage
            Route::get('tenant/plan', [\App\Infrastructure\Http\Controllers\Tenant\TenantPlanController::class, 'show']);

            // Tenant billing profile
            Route::get('tenant/billing-profile', [\App\Infrastructure\Http\Controllers\Tenant\BillingProfileController::class, 'show']);
            Route::patch('tenant/billing-profile', [\App\Infrastructure\Http\Controllers\Tenant\BillingProfileController::class, 'update']);
            Route::get('tenant/billing-profile/lookup', [\App\Infrastructure\Http\Controllers\Tenant\BillingProfileController::class, 'lookup']);

            // Tenant billing cert (SRI electronic invoicing certificate)
            Route::get('settings/billing-cert', [\App\Infrastructure\Http\Controllers\Tenant\BillingProfileController::class, 'showCert']);
            Route::post('settings/billing-cert', [\App\Infrastructure\Http\Controllers\Tenant\BillingProfileController::class, 'uploadCert']);
            // Ambiente SRI + establecimiento / punto de emisión, without re-uploading the .p12
            Route::put('settings/billing-emission', [\App\Infrastructure\Http\Controllers\Tenant\BillingProfileController::class, 'updateEmission']);

            // Reservations
            // NOTE: reservations/available-slots moved to the customer booking
            // group above (no email gate) — it backs the public booking screen.
            Route::get('reservations', [ReservationController::class, 'index']);
            Route::post('reservations', [ReservationController::class, 'store']);
            Route::get('reservations/{id}', [ReservationController::class, 'show']);
            Route::patch('reservations/{id}/confirm', [ReservationController::class, 'confirm']);
            Route::patch('reservations/{id}/start', [ReservationController::class, 'start']);
            Route::patch('reservations/{id}/complete', [ReservationController::class, 'complete']);
            Route::patch('reservations/{id}/cancel', [ReservationController::class, 'cancel']);
            Route::patch('reservations/{id}/reschedule', [ReservationController::class, 'reschedule']);
            Route::patch('reservations/{id}/no_show', [ReservationController::class, 'noShow']);

            // Check-in flow (Phase 3): freeze billing data + reserve BOM consumibles.
            Route::post('reservations/{id}/check-in', [ReservationCheckInController::class, 'checkIn']);
            Route::patch('reservations/{id}/billing', [ReservationCheckInController::class, 'updateBilling']);

            // Phase 1 pago: independent of lifecycle status. Cashier
            // records method + reference when the customer pays —
            // sometimes upfront, sometimes at pickup.
            Route::post('reservations/{id}/payment', [\App\Infrastructure\Http\Controllers\Reservation\ReservationPaymentController::class, 'record']);
            Route::post('reservations/{id}/invoice', [ReservationController::class, 'invoice']);

            // Polymorphic line items + audit log.
            Route::get('reservations/{id}/items', [ReservationItemController::class, 'index']);
            Route::post('reservations/{id}/items', [ReservationItemController::class, 'store']);
            Route::delete('reservation-items/{id}', [ReservationItemController::class, 'destroy']);
            Route::patch('reservation-items/{id}/price', [ReservationItemController::class, 'overridePrice']);
            Route::get('reservations/{id}/changes', [ReservationItemController::class, 'changes']);

            // Personal que ejecuta el servicio sin ser usuario de la app
            // (lavador / secador). Lectura abierta a miembros porque el
            // select del Registro Diario la necesita; escritura del dueño.
            Route::get('service-staff', [ServiceStaffController::class, 'index']);
            Route::post('service-staff', [ServiceStaffController::class, 'store']);
            Route::patch('service-staff/{id}', [ServiceStaffController::class, 'update']);

            // Service logs
            Route::get('service-logs/summary', [ServiceLogController::class, 'summary']);
            Route::get('service-logs', [ServiceLogController::class, 'index']);
            Route::post('service-logs', [ServiceLogController::class, 'store']);
            Route::get('service-logs/{id}', [ServiceLogController::class, 'show']);
            Route::patch('service-logs/{id}', [ServiceLogController::class, 'update']);
            Route::put('service-logs/{id}/items', [ServiceLogController::class, 'updateItems']);
            // Asignar lavador y secador. Gate doble: privilegio en progreso,
            // solo admin una vez completado.
            Route::patch('service-logs/{id}/assignees', [ServiceLogController::class, 'updateAssignees']);
            Route::delete('service-logs/{id}', [ServiceLogController::class, 'destroy']);
            Route::patch('service-logs/{id}/complete', [ServiceLogController::class, 'complete']);
            // Late payment registration — cashier marks a "cobrar al
            // retirar" service as paid + captures method + bank.
            Route::post('service-logs/{id}/payment', [ServiceLogController::class, 'recordPayment']);
            // Revertir un cobro entero. Sólo dueño o admin: quien cobra no se
            // absuelve solo. El servicio queda, la plata vuelve a estar por
            // cobrar. Anular el registro es otra cosa: ver `cancel`.
            Route::delete('service-logs/{id}/payment', [ServiceLogController::class, 'revertPayment']);
            // Anular el registro entero: queda como historia, congelado y
            // fuera de los totales. Reemplaza al borrado, que no dejaba nada.
            Route::post('service-logs/{id}/cancel', [ServiceLogController::class, 'cancel']);
            // Billing: manually trigger invoice emission or re-emit a rejected one.
            Route::post('service-logs/{id}/invoice', [ServiceLogController::class, 'invoice']);
            // Billing: view / correct the client's fiscal profile used for
            // this log's factura (occasional correction, not per-emit).
            Route::get('service-logs/{id}/billing', [ServiceLogController::class, 'showBilling']);
            Route::put('service-logs/{id}/billing', [ServiceLogController::class, 'updateBilling']);
            // Billing: list all invoiced service logs for the tenant.
            Route::get('invoices', [ServiceLogController::class, 'indexInvoiced']);
            // Billing: proxy XML download through backend to enforce auth.
            Route::get('service-logs/{id}/invoice/xml', [ServiceLogController::class, 'downloadInvoiceXml']);

            // Caja del día. Ver el spec: el esperado no se expone hasta el
            // cierre, así que no hay endpoint que lo devuelva.
            Route::get('cash-session', [CashSessionController::class, 'current']);
            Route::post('cash-sessions', [CashSessionController::class, 'open']);
            Route::post('cash-sessions/{id}/movements', [CashSessionController::class, 'addMovement']);
            Route::post('cash-sessions/{id}/close', [CashSessionController::class, 'close']);

            // Deuda: la libreta del dueño y el cobro repartido.
            Route::post('debts/manual', [DebtController::class, 'storeManual']);
            Route::post('debts/payments', [DebtController::class, 'storePayment']);
            // Billing: proxy direct access to billing service invoice list + RIDE PDF.
            Route::get('billing/invoices', [InvoiceProxyController::class, 'index']);
            Route::get('billing/invoices/{id}/ride', [InvoiceProxyController::class, 'ride']);
            Route::get('billing/invoices/{id}/xml', [InvoiceProxyController::class, 'xml']);

            // NOTE: client-resources routes moved to the customer booking group
            // above (no email gate) — they back the public booking screen.

            // Business Resources (stations, chairs, rooms)
            Route::get('business-resources', [BusinessResourceController::class, 'index']);
            Route::post('business-resources', [BusinessResourceController::class, 'store']);
            Route::patch('business-resources/{id}', [BusinessResourceController::class, 'update']);
            Route::delete('business-resources/{id}', [BusinessResourceController::class, 'destroy']);

            // Services
            Route::get('services', [ServiceController::class, 'index']);
            Route::get('services/{id}', [ServiceController::class, 'show']);
            Route::post('services', [ServiceController::class, 'store']);
            Route::put('services/{id}', [ServiceController::class, 'update']);
            Route::delete('services/{id}', [ServiceController::class, 'destroy']);

            // Service variants (size / type / duration buckets within a service)
            Route::get('services/{id}/variants', [ServiceVariantController::class, 'index']);
            Route::post('services/{id}/variants', [ServiceVariantController::class, 'store']);
            Route::patch('service-variants/{id}', [ServiceVariantController::class, 'update']);
            Route::delete('service-variants/{id}', [ServiceVariantController::class, 'destroy']);

            // BOM: products consumed per variant of a service
            Route::get('service-variants/{id}/consumption', [BomController::class, 'index']);
            Route::put('service-variants/{id}/consumption', [BomController::class, 'replace']);

            // Inventory: products + kardex + manual movements
            Route::get('products', [ProductController::class, 'index']);
            Route::post('products', [ProductController::class, 'store']);
            Route::get('products/{id}', [ProductController::class, 'show']);
            Route::patch('products/{id}', [ProductController::class, 'update']);
            Route::delete('products/{id}', [ProductController::class, 'destroy']);
            Route::get('products/{id}/movements', [StockMovementController::class, 'index']);
            Route::post('stock-movements', [StockMovementController::class, 'store']);

            // Users
            Route::get('users', [UserController::class, 'index']);
            Route::post('users/invite', [UserController::class, 'store']);
            Route::get('users/{id}', [UserController::class, 'show']);
            Route::patch('users/{id}/role', [UserController::class, 'updateRole']);
            Route::patch('users/{id}/password', [UserController::class, 'resetPassword']);
            Route::patch('clients/{id}', [UserController::class, 'updateClient']);

            // Client search (dedup walk-in) + claim invite.
            Route::get('clients/search', [ClientSearchController::class, 'search']);
            Route::post('clients/{id}/link-to-tenant', [ClientSearchController::class, 'linkToTenant']);
            Route::post('clients/{id}/invite-app', [ClaimController::class, 'inviteToApp']);

            Route::post('client-resources/{id}/transfer', [ClientResourceLookupController::class, 'transfer']);

            // Reports
            Route::get('reports/daily', [ReportController::class, 'daily']);
            Route::get('reports/range', [ReportController::class, 'range']);
            Route::get('reports/weekly', [ReportController::class, 'weekly']);
            Route::get('reports/monthly', [ReportController::class, 'monthly']);
            Route::get('reports/discounts', [ReportController::class, 'discounts']);

            // Uploads
            Route::post('uploads', [UploadController::class, 'store']);

            // Tenant gallery images
            Route::get('tenant/images', [TenantImageController::class, 'index']);
            Route::post('tenant/images', [TenantImageController::class, 'store']);
            Route::delete('tenant/images/{id}', [TenantImageController::class, 'destroy']);
            Route::post('tenant/images/reorder', [TenantImageController::class, 'reorder']);

            // Availability slots (weekly schedule)
            Route::get('availability-slots', [\App\Infrastructure\Http\Controllers\AvailabilitySlotController::class, 'index']);
            Route::put('availability-slots', [\App\Infrastructure\Http\Controllers\AvailabilitySlotController::class, 'bulkUpdate']);

            // Availability blocks
            Route::get('availability-blocks', [\App\Infrastructure\Http\Controllers\AvailabilityBlockController::class, 'index']);
            Route::post('availability-blocks', [\App\Infrastructure\Http\Controllers\AvailabilityBlockController::class, 'store']);
            Route::delete('availability-blocks/{id}', [\App\Infrastructure\Http\Controllers\AvailabilityBlockController::class, 'destroy']);
        });

        // Super admin routes
        Route::middleware('super_admin')->prefix('superadmin')->group(function () {
            Route::get('tenants', [SuperAdminController::class, 'index']);
            Route::patch('tenants/{id}/suspend', [SuperAdminController::class, 'suspend']);
            Route::patch('tenants/{id}/activate', [SuperAdminController::class, 'activate']);
            Route::get('users', [SuperAdminController::class, 'users']);
            Route::get('stats', [SuperAdminController::class, 'stats']);

            Route::get('categories', [\App\Infrastructure\Http\Controllers\SuperAdmin\BusinessCategoryController::class, 'index']);
            Route::post('categories', [\App\Infrastructure\Http\Controllers\SuperAdmin\BusinessCategoryController::class, 'store']);
            Route::patch('categories/{id}', [\App\Infrastructure\Http\Controllers\SuperAdmin\BusinessCategoryController::class, 'update']);
            Route::delete('categories/{id}', [\App\Infrastructure\Http\Controllers\SuperAdmin\BusinessCategoryController::class, 'destroy']);

            // Plans CRUD
            Route::get('plans', [\App\Infrastructure\Http\Controllers\SuperAdmin\PlanController::class, 'index']);
            Route::post('plans', [\App\Infrastructure\Http\Controllers\SuperAdmin\PlanController::class, 'store']);
            Route::patch('plans/{id}', [\App\Infrastructure\Http\Controllers\SuperAdmin\PlanController::class, 'update']);
            Route::delete('plans/{id}', [\App\Infrastructure\Http\Controllers\SuperAdmin\PlanController::class, 'destroy']);

            // Assign plan to tenant
            Route::post('tenants/{id}/assign-plan', [SuperAdminController::class, 'assignPlan']);
            Route::post('tenants/{id}/impersonate', [SuperAdminController::class, 'impersonate']);
        });
    });
});
