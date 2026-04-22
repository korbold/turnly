<?php

namespace App\Infrastructure\Console\Commands;

use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Console\Command;

class CheckExpiredTrialsCommand extends Command
{
    protected $signature = 'plan:check-trials';
    protected $description = 'Suspend tenants with expired trials';

    public function handle(): int
    {
        $expired = TenantModel::where('is_trial', true)
            ->where('trial_ends_at', '<', now())
            ->where('status', '!=', 'suspended')
            ->get();

        $count = 0;
        foreach ($expired as $tenant) {
            $tenant->update(['status' => 'suspended']);
            $count++;
            $this->info("Suspended: {$tenant->name} ({$tenant->slug})");
        }

        $this->info("Done. {$count} tenant(s) suspended.");

        return Command::SUCCESS;
    }
}
