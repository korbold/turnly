<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: Add new columns
        Schema::table('tenants', function (Blueprint $table) {
            $table->uuid('plan_id')->nullable()->after('country');
            $table->boolean('is_trial')->default(false)->after('plan_id');
            $table->foreign('plan_id')->references('id')->on('plans')->nullOnDelete();
        });

        // Step 2: Migrate data
        $planMap = DB::table('plans')->pluck('id', 'slug');

        // trial → is_trial=true, plan_id=null
        DB::table('tenants')->where('plan', 'trial')->update([
            'is_trial' => true,
            'plan_id' => null,
        ]);

        // basic → plan_id=basic UUID
        if ($planMap->has('basic')) {
            DB::table('tenants')->where('plan', 'basic')->update([
                'is_trial' => false,
                'plan_id' => $planMap['basic'],
            ]);
        }

        // pro → plan_id=pro UUID
        if ($planMap->has('pro')) {
            DB::table('tenants')->where('plan', 'pro')->update([
                'is_trial' => false,
                'plan_id' => $planMap['pro'],
            ]);
        }

        // Step 3: Drop old column
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('plan');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('plan')->default('trial')->after('country');
        });

        $planMap = DB::table('plans')->pluck('slug', 'id');

        DB::table('tenants')->where('is_trial', true)->update(['plan' => 'trial']);

        foreach ($planMap as $planId => $slug) {
            DB::table('tenants')->where('plan_id', $planId)->update(['plan' => $slug]);
        }

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropForeign(['plan_id']);
            $table->dropColumn(['plan_id', 'is_trial']);
        });
    }
};
