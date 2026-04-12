<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('wash_logs', 'service_logs');
    }

    public function down(): void
    {
        Schema::rename('service_logs', 'wash_logs');
    }
};
