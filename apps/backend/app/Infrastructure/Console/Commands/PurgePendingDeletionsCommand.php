<?php

declare(strict_types=1);

namespace App\Infrastructure\Console\Commands;

use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgePendingDeletionsCommand extends Command
{
    protected $signature = 'accounts:purge-deletions';

    protected $description = 'Permanently delete accounts that completed their 30-day grace period';

    public function handle(): int
    {
        $cutoff = now()->subDays(30);

        $users = UserModel::whereNotNull('deletion_requested_at')
            ->where('deletion_requested_at', '<=', $cutoff)
            ->get();

        if ($users->isEmpty()) {
            $this->info('No accounts to purge.');
            return self::SUCCESS;
        }

        $count = 0;
        DB::transaction(function () use ($users, &$count) {
            foreach ($users as $user) {
                $tenantIds = DB::table('tenant_users')
                    ->where('user_id', $user->id)
                    ->pluck('tenant_id');

                $user->tokens()->delete();
                $user->delete();

                foreach ($tenantIds as $tenantId) {
                    $remaining = DB::table('tenant_users')
                        ->where('tenant_id', $tenantId)
                        ->count();
                    if ($remaining === 0) {
                        DB::table('tenants')->where('id', $tenantId)->delete();
                    }
                }

                $count++;
            }
        });

        $this->info("Purged {$count} account(s) past 30-day grace period.");

        return self::SUCCESS;
    }
}
