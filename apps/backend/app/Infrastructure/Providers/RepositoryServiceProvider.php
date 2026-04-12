<?php

namespace App\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use App\Domain\Tenant\Contracts\TenantRepositoryInterface;
use App\Domain\Reservation\Contracts\ReservationRepositoryInterface;
use App\Domain\WashLog\Contracts\WashLogRepositoryInterface;
use App\Domain\ClientResource\Contracts\ClientResourceRepositoryInterface;
use App\Domain\User\Contracts\UserRepositoryInterface;
use App\Infrastructure\Persistence\Repositories\EloquentTenantRepository;
use App\Infrastructure\Persistence\Repositories\EloquentReservationRepository;
use App\Infrastructure\Persistence\Repositories\EloquentWashLogRepository;
use App\Infrastructure\Persistence\Repositories\EloquentClientResourceRepository;
use App\Infrastructure\Persistence\Repositories\EloquentUserRepository;

class RepositoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(TenantRepositoryInterface::class, EloquentTenantRepository::class);
        $this->app->bind(ReservationRepositoryInterface::class, EloquentReservationRepository::class);
        $this->app->bind(WashLogRepositoryInterface::class, EloquentWashLogRepository::class);
        $this->app->bind(ClientResourceRepositoryInterface::class, EloquentClientResourceRepository::class);
        $this->app->bind(UserRepositoryInterface::class, EloquentUserRepository::class);
    }
}
