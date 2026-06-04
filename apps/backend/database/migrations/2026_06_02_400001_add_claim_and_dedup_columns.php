<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Marks ghost users (created by a cashier in walk-in) so the
            // claim flow can offer the cuenta to the customer when they
            // sign up later. NULL until the customer takes possession.
            $table->timestamp('claimed_at')->nullable();
            $table->boolean('created_by_walkin')->default(false);
            $table->index('phone'); // searches by phone in client search
        });

        Schema::create('claim_tokens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('token_hash', 64)->unique();
            $table->string('pin', 8)->nullable();
            $table->enum('method', ['magic_link', 'qr_pin'])->default('magic_link');
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('created_by_user_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['user_id', 'used_at']);
            $table->index(['pin', 'expires_at']);
        });

        // Re-introduce the (tenant_id, plate) uniqueness that the earlier
        // make-plate-nullable migration removed. MySQL treats NULLs as
        // distinct under unique indexes, so customers without a plate
        // can still coexist.
        Schema::table('client_resources', function (Blueprint $table) {
            $table->unique(['tenant_id', 'plate'], 'client_resources_tenant_plate_unique');
        });
    }

    public function down(): void
    {
        Schema::table('client_resources', function (Blueprint $table) {
            $table->dropUnique('client_resources_tenant_plate_unique');
        });

        Schema::dropIfExists('claim_tokens');

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['phone']);
            $table->dropColumn(['claimed_at', 'created_by_walkin']);
        });
    }
};
