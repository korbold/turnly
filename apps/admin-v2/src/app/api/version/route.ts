/**
 * Qué commit está desplegado acá.
 *
 * Existe para los E2E: el backend puede estar listo mientras Vercel todavía
 * construye, y los tests pegarían contra el bundle viejo. El workflow hace
 * polling a esta ruta hasta que el SHA coincide con el commit que disparó la
 * corrida. `VERCEL_GIT_COMMIT_SHA` lo inyecta Vercel sola en el build.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    env: process.env.VERCEL_ENV ?? 'development',
  });
}
