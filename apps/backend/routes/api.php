<?php

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
use App\Infrastructure\Http\Controllers\Billing\UserBillingProfileController;
use App\Infrastructure\Http\Controllers\ServiceLog\ServiceLogController;
use App\Infrastructure\Http\Controllers\ClientResource\ClientResourceController;
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
        ->middleware('throttle:public-book');
});

Route::prefix('v1')->group(function () {

    // Public auth
    Route::post('auth/register', [AuthController::class, 'register'])
        ->middleware('throttle:5,60');
    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:login');
    Route::post('auth/google', [GoogleAuthController::class, 'login'])
        ->middleware('throttle:google-auth');
    Route::post('auth/magic-link/request', [MagicLinkController::class, 'request'])
        ->middleware(['throttle:magic-link-email', 'throttle:magic-link-global']);
    Route::post('auth/magic-link/verify', [MagicLinkController::class, 'verify'])
        ->middleware('throttle:10,60');
    Route::post('auth/verify-email', [AuthController::class, 'verifyEmail'])
        ->middleware('throttle:10,60');
    Route::post('auth/verify-email/resend', [AuthController::class, 'resendVerification'])
        ->middleware('throttle:5,60');

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

        // Phase 3.5 — customer can edit pending/confirmed reservations.
        Route::get('client/reservations/{id}/items', [ClientReservationItemController::class, 'index']);
        Route::post('client/reservations/{id}/items', [ClientReservationItemController::class, 'store']);
        Route::delete('client/reservation-items/{id}', [ClientReservationItemController::class, 'destroy']);

        // Device tokens (tenant middleware tolerates no-slug for client app)
        Route::middleware('tenant')->group(function () {
            Route::post('device-tokens', [\App\Infrastructure\Http\Controllers\Notification\DeviceTokenController::class, 'store']);
            Route::delete('device-tokens/{token}', [\App\Infrastructure\Http\Controllers\Notification\DeviceTokenController::class, 'destroy']);
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

        // Tenant-scoped routes (require verified email)
        Route::middleware(['verified.email', 'tenant'])->group(function () {
            // Auth
            Route::get('auth/me', [AuthController::class, 'me']);

            // Tenant settings
            Route::get('tenant/settings', [TenantSettingsController::class, 'show']);
            Route::patch('tenant/settings', [TenantSettingsController::class, 'update']);

            // Tenant plan + usage
            Route::get('tenant/plan', [\App\Infrastructure\Http\Controllers\Tenant\TenantPlanController::class, 'show']);

            // Tenant billing profile
            Route::get('tenant/billing-profile', [\App\Infrastructure\Http\Controllers\Tenant\BillingProfileController::class, 'show']);
            Route::patch('tenant/billing-profile', [\App\Infrastructure\Http\Controllers\Tenant\BillingProfileController::class, 'update']);
            Route::get('tenant/billing-profile/lookup', [\App\Infrastructure\Http\Controllers\Tenant\BillingProfileController::class, 'lookup']);

            // Reservations
            Route::get('reservations/available-slots', [ReservationController::class, 'availableSlots']);
            Route::get('reservations', [ReservationController::class, 'index']);
            Route::post('reservations', [ReservationController::class, 'store']);
            Route::get('reservations/{id}', [ReservationController::class, 'show']);
            Route::patch('reservations/{id}/confirm', [ReservationController::class, 'confirm']);
            Route::patch('reservations/{id}/start', [ReservationController::class, 'start']);
            Route::patch('reservations/{id}/complete', [ReservationController::class, 'complete']);
            Route::patch('reservations/{id}/cancel', [ReservationController::class, 'cancel']);
            Route::patch('reservations/{id}/no_show', [ReservationController::class, 'noShow']);

            // Check-in flow (Phase 3): freeze billing data + reserve BOM consumibles.
            Route::post('reservations/{id}/check-in', [ReservationCheckInController::class, 'checkIn']);
            Route::patch('reservations/{id}/billing', [ReservationCheckInController::class, 'updateBilling']);

            // Polymorphic line items + audit log.
            Route::get('reservations/{id}/items', [ReservationItemController::class, 'index']);
            Route::post('reservations/{id}/items', [ReservationItemController::class, 'store']);
            Route::delete('reservation-items/{id}', [ReservationItemController::class, 'destroy']);
            Route::patch('reservation-items/{id}/price', [ReservationItemController::class, 'overridePrice']);
            Route::get('reservations/{id}/changes', [ReservationItemController::class, 'changes']);

            // Service logs
            Route::get('service-logs/summary', [ServiceLogController::class, 'summary']);
            Route::get('service-logs', [ServiceLogController::class, 'index']);
            Route::post('service-logs', [ServiceLogController::class, 'store']);
            Route::get('service-logs/{id}', [ServiceLogController::class, 'show']);
            Route::patch('service-logs/{id}', [ServiceLogController::class, 'update']);
            Route::delete('service-logs/{id}', [ServiceLogController::class, 'destroy']);
            Route::patch('service-logs/{id}/complete', [ServiceLogController::class, 'complete']);

            // Client Resources
            Route::get('client-resources', [ClientResourceController::class, 'index']);
            Route::post('client-resources', [ClientResourceController::class, 'store']);
            Route::get('client-resources/{id}', [ClientResourceController::class, 'show']);
            Route::patch('client-resources/{id}', [ClientResourceController::class, 'update']);
            Route::delete('client-resources/{id}', [ClientResourceController::class, 'destroy']);
            Route::get('client-resources/{id}/history', [ClientResourceController::class, 'history']);

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

            // Reports
            Route::get('reports/daily', [ReportController::class, 'daily']);
            Route::get('reports/range', [ReportController::class, 'range']);
            Route::get('reports/weekly', [ReportController::class, 'weekly']);
            Route::get('reports/monthly', [ReportController::class, 'monthly']);

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
