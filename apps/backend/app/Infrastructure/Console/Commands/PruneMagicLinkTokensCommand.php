<?php

declare(strict_types=1);

namespace App\Infrastructure\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneMagicLinkTokensCommand extends Command
{
    protected $signature = 'magic-link:prune {--hours=24}';

    protected $description = 'Delete magic link tokens that expired more than N hours ago';

    public function handle(): int
    {
        $hours = (int) $this->option('hours');
        $cutoff = now()->subHours($hours);

        $deleted = DB::table('magic_link_tokens')
            ->where('expires_at', '<', $cutoff)
            ->delete();

        $this->info("Pruned {$deleted} magic link token(s) older than {$hours}h.");

        return self::SUCCESS;
    }
}
