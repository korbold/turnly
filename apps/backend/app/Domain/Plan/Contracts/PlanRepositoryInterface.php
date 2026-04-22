<?php

namespace App\Domain\Plan\Contracts;

use App\Domain\Plan\Entities\Plan;

interface PlanRepositoryInterface
{
    public function findById(string $id): ?Plan;

    public function findBySlug(string $slug): ?Plan;

    public function all(): array;

    public function save(Plan $plan): Plan;

    public function delete(string $id): void;
}
