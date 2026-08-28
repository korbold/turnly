<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Borrar a una persona no puede borrar el vehículo.
 *
 * `client_resources.client_id` venía con ON DELETE CASCADE desde que la tabla
 * se llamaba `vehicles` y su dueño era una cuenta de la app. Con el mostrador
 * creando un usuario por cada walk-in, esa regla dejó de significar "el auto
 * es de esta cuenta" y pasó a significar "si la cuenta desaparece, el auto
 * también": `users:purge-unverified` borraba al walk-in a las 24h y se
 * llevaba el auto puesto, dejando el servicio en "Sin recurso".
 *
 * El comando ya no los toca, pero el candado no puede vivir sólo ahí. La
 * regla correcta es la que ya usa `release()`: un vehículo sin dueño conocido
 * es un walk-in, y sigue siendo del local con todo su historial.
 *
 * SQLite no aplica claves foráneas y no sabe alterarlas: los tests corren
 * sobre el modelo, no sobre la base.
 */
return new class extends Migration
{
    private function skip(): bool
    {
        return DB::connection()->getDriverName() === 'sqlite';
    }

    public function up(): void
    {
        if ($this->skip()) {
            return;
        }

        Schema::table('client_resources', function (Blueprint $table) {
            $table->dropForeign(['client_id']);
            $table->foreign('client_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if ($this->skip()) {
            return;
        }

        Schema::table('client_resources', function (Blueprint $table) {
            $table->dropForeign(['client_id']);
            $table->foreign('client_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
