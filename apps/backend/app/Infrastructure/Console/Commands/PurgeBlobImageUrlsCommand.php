<?php

declare(strict_types=1);

namespace App\Infrastructure\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgeBlobImageUrlsCommand extends Command
{
    protected $signature = 'images:purge-blob-urls {--dry-run}';

    protected $description = 'Null out image_url / logo_url / cover_url that point to blob: URLs (dead browser-only references)';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $targets = [
            ['table' => 'services', 'column' => 'image_url'],
            ['table' => 'tenants',  'column' => 'logo_url'],
            ['table' => 'tenants',  'column' => 'cover_url'],
        ];

        $total = 0;
        foreach ($targets as $t) {
            $count = DB::table($t['table'])
                ->where($t['column'], 'like', 'blob:%')
                ->count();

            if ($count === 0) {
                $this->line("{$t['table']}.{$t['column']}: 0 rows");
                continue;
            }

            if (!$dryRun) {
                DB::table($t['table'])
                    ->where($t['column'], 'like', 'blob:%')
                    ->update([$t['column'] => null]);
            }

            $this->info(($dryRun ? '[dry-run] ' : '') . "{$t['table']}.{$t['column']}: {$count} rows " . ($dryRun ? 'would be cleared' : 'cleared'));
            $total += $count;
        }

        $this->info(($dryRun ? '[dry-run] total: ' : 'Total cleared: ') . $total);

        return self::SUCCESS;
    }
}
