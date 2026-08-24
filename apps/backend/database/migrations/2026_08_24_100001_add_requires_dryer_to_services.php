<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Qué servicios llevan secador. La regla vieja era del tenant entero —si es
 * lavadora, exigí lavador Y secador para completar— y en un catálogo real eso
 * es falso para la mayoría: un lavado de chasis no se seca, y un cambio de
 * aceite ni se lava.
 *
 * Arranca en `false` a propósito. El default contrario dejaría a cada tenant
 * bloqueado hasta que configure, que es exactamente el problema que esto
 * viene a sacar del medio; el dueño tilda las lavadas completas y listo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->boolean('requires_dryer')->default(false)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn('requires_dryer');
        });
    }
};
