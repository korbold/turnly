<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Qué personal lleva cada servicio. La regla vieja era del rubro entero —si es
 * lavadora, exigí lavador Y secador para completar— y en un catálogo real es
 * falsa para la mayoría: un lavado de chasis no se seca, y un cambio de aceite
 * no lo lava nadie.
 *
 * Un campo con tres valores y no dos booleanos: los casos están anidados (si
 * lleva secador, lleva lavador), así que dos banderas permitirían guardar la
 * contradicción "secador sí, lavador no".
 *
 * El default es `washer` y no `none`: mantiene la garantía de que un trabajo
 * tiene autor. Con `none` por defecto la feature quedaría apagada en todos los
 * servicios hasta que alguien la configure, que es lo contrario de lo que
 * este gate existe para hacer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->string('staffing', 20)->default('washer')->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn('staffing');
        });
    }
};
