<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Local mirror of the SRI's public taxpayer registry (catastro del RUC),
     * published per province as open data at descargas.sri.gob.ec.
     *
     * Exists because the SRI's live lookup endpoint (srienlinea.sri.gob.ec)
     * is unreachable from datacenter IPs — it completes the TLS handshake
     * and then swallows the request — and is unusable from the browser too,
     * since its F5 duplicates the Access-Control-Allow-Origin header. A
     * nightly-ish file import is the only path that actually works.
     *
     * Only ACTIVO taxpayers are stored: a suspended RUC can't be invoiced,
     * and dropping them halves the row count.
     */
    public function up(): void
    {
        Schema::create('sri_taxpayers', function (Blueprint $table) {
            $table->char('tax_id', 13)->primary();
            $table->string('legal_name', 255);
            $table->boolean('accounting_required')->default(false);
            $table->boolean('withholding_agent')->default(false);
            $table->boolean('special_taxpayer')->default(false);
            $table->string('province', 60)->nullable();
            $table->timestamp('synced_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sri_taxpayers');
    }
};
