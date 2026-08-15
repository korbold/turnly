<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Walk-ins registered at the counter may have no identified owner: when
 * the tenant configured no name custom field, the resource used to be
 * filed under the logged-in employee's user id, and the Clientes browse
 * filter (which hides staff-owned resources) then made it disappear.
 * Unowned is now a first-class state.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // SQLite (test suite) rebuilds the table; the FK is recreated
            // by change() so no manual drop/add is needed.
            Schema::table('client_resources', function ($table) {
                $table->char('client_id', 36)->nullable()->change();
            });

            return;
        }

        // MySQL: raw MODIFY keeps client_resources_client_id_foreign in
        // place (NULL is always accepted by a foreign key).
        DB::statement('ALTER TABLE client_resources MODIFY client_id CHAR(36) NULL');
    }

    public function down(): void
    {
        // Rows orphaned while the column was nullable cannot be restored
        // to a real owner, so they are dropped from the constraint's
        // reach by deleting nothing — the rollback only re-tightens the
        // column and will fail loudly if unowned rows still exist.
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('client_resources', function ($table) {
                $table->char('client_id', 36)->nullable(false)->change();
            });

            return;
        }

        DB::statement('ALTER TABLE client_resources MODIFY client_id CHAR(36) NOT NULL');
    }
};
