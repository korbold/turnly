<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 50)->unique();
            $table->string('name', 100);
            $table->string('icon', 50)->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Seed existing categories
        $now = now();
        $categories = [
            ['slug' => 'car_wash', 'name' => 'Car Wash', 'icon' => 'local_car_wash', 'sort_order' => 1],
            ['slug' => 'barbershop', 'name' => 'Barberia', 'icon' => 'content_cut', 'sort_order' => 2],
            ['slug' => 'medical', 'name' => 'Medico', 'icon' => 'medical_services', 'sort_order' => 3],
            ['slug' => 'spa', 'name' => 'Spa', 'icon' => 'spa', 'sort_order' => 4],
            ['slug' => 'gym', 'name' => 'Gym', 'icon' => 'fitness_center', 'sort_order' => 5],
            ['slug' => 'other', 'name' => 'Otro', 'icon' => 'store', 'sort_order' => 6],
        ];
        foreach ($categories as $cat) {
            DB::table('business_categories')->insert(array_merge($cat, [
                'id' => \Illuminate\Support\Str::uuid(),
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }

        // Change business_type from enum to varchar (MySQL only; SQLite stores all as text)
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE tenants MODIFY business_type VARCHAR(50) NULL");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE tenants MODIFY business_type ENUM('car_wash','barbershop','medical','spa','gym','other') NULL");
        }
        Schema::dropIfExists('business_categories');
    }
};
