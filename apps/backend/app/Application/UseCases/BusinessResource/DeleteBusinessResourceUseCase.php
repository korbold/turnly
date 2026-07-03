<?php

namespace App\Application\UseCases\BusinessResource;

use App\Domain\BusinessResource\Contracts\BusinessResourceRepositoryInterface;

class DeleteBusinessResourceUseCase
{
    public function __construct(private BusinessResourceRepositoryInterface $repo) {}

    public function execute(string $id): void
    {
        $this->repo->delete($id);
    }
}
