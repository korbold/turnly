<?php

declare(strict_types=1);

namespace App\Infrastructure\Console\Commands;

use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgeUnverifiedUsersCommand extends Command
{
    protected $signature = 'users:purge-unverified {--hours=24}';

    protected $description = 'Delete users that never verified their email after N hours';

    public function handle(): int
    {
        $hours = (int) $this->option('hours');
        $cutoff = now()->subHours($hours);

        $users = UserModel::whereNull('email_verified_at')
            ->where('created_at', '<', $cutoff)
            ->get();

        if ($users->isEmpty()) {
            $this->info('No unverified users to purge.');
            return self::SUCCESS;
        }

        $count = 0;
        DB::transaction(function () use ($users, &$count) {
            foreach ($users as $user) {
                // Cascade delete via tenant_users + email_verification_codes (FK).
                // Tenants created during register are dropped if no other user remains.
                $tenantIds = DB::table('tenant_users')
                    ->where('user_id', $user->id)
                    ->pluck('tenant_id');

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

        $this->info("Purged {$count} unverified user(s) older than {$hours}h.");

        return self::SUCCESS;
    }
}
