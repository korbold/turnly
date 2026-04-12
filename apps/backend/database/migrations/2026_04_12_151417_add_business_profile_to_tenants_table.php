<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->enum('business_type', ['car_wash', 'barbershop', 'medical', 'spa', 'gym', 'other'])
                ->default('other')->after('country');
            $table->json('custom_fields')->nullable()->after('business_type');
            $table->text('description')->nullable()->after('name');
            $table->string('address', 255)->nullable()->after('phone');
            $table->string('logo_url', 500)->nullable()->after('settings');
            $table->string('cover_url', 500)->nullable()->after('logo_url');
            $table->json('social_links')->nullable()->after('cover_url');
            $table->string('brand_theme', 20)->default('blue')->after('social_links');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn([
                'business_type', 'custom_fields', 'description', 'address',
                'logo_url', 'cover_url', 'social_links', 'brand_theme',
            ]);
        });
    }
};
