<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('business_categories', function (Blueprint $table) {
            $table->string('emoji', 10)->nullable()->after('name');
            $table->string('color', 20)->nullable()->after('emoji');
            $table->string('description', 200)->nullable()->after('color');
        });

        // Seed existing categories with emoji, color, description
        $defaults = [
            'car_wash'   => ['emoji' => '🚗', 'color' => '#3B82F6', 'description' => 'Lavado de vehiculos'],
            'barbershop' => ['emoji' => '💈', 'color' => '#F97316', 'description' => 'Cortes y estilos'],
            'medical'    => ['emoji' => '🏥', 'color' => '#14B8A6', 'description' => 'Consultas medicas'],
            'spa'        => ['emoji' => '🧖', 'color' => '#A855F7', 'description' => 'Bienestar y relax'],
            'gym'        => ['emoji' => '💪', 'color' => '#EF4444', 'description' => 'Entrenamiento'],
            'other'      => ['emoji' => '🏪', 'color' => '#6B7280', 'description' => 'Otros servicios'],
        ];

        foreach ($defaults as $slug => $data) {
            DB::table('business_categories')->where('slug', $slug)->update($data);
        }
    }

    public function down(): void
    {
        Schema::table('business_categories', function (Blueprint $table) {
            $table->dropColumn(['emoji', 'color', 'description']);
        });
    }
};
