<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the unique constraint on email so we can make it nullable.
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['email']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->string('username', 60)->nullable()->after('email');
        });

        // Re-add a unique index that only constrains non-null emails.
        // MySQL treats NULLs as distinct in unique indexes, so multiple users
        // without email are allowed. Same applies to username.
        DB::statement('CREATE UNIQUE INDEX users_email_unique ON users (email)');
        DB::statement('CREATE UNIQUE INDEX users_username_unique ON users (username)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX users_username_unique ON users');
        DB::statement('DROP INDEX users_email_unique ON users');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('username');
            $table->string('email')->nullable(false)->change();
            $table->unique('email');
        });
    }
};
