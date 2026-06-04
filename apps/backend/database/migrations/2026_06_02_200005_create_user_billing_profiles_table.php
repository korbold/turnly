<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reusable billing identity per customer. A user can keep multiple
     * profiles (personal cedula, employer RUC, etc.) and pick the default.
     * `final_consumer` is the SRI generic profile (RUC 9999999999999)
     * used when the customer declines to identify; allowed up to $200.
     */
    public function up(): void
    {
        Schema::create('user_billing_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->enum('doc_type', ['ruc', 'cedula', 'passport', 'final_consumer']);
            $table->string('doc_number', 13);
            $table->string('legal_name', 255);
            $table->string('address', 500)->nullable();
            $table->string('email', 255);
            $table->string('phone', 30)->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'is_default']);
            // Same (user, doc_type, doc_number) shouldn't be duplicated —
            // helps when an admin syncs profiles or the user retypes.
            $table->unique(['user_id', 'doc_type', 'doc_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_billing_profiles');
    }
};
