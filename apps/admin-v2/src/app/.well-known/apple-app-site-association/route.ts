import { NextResponse } from 'next/server';

// iOS Universal Links manifest, served at
// /.well-known/apple-app-site-association with content-type application/json
// and no file extension (Apple requirement).
//
// `paths` excludes shell/marketing/auth routes so Universal Links only fire on
// tenant slug pages; everything else stays in Safari.

const APP_ID = 'T74J34B234.com.turnly.customer';

const aasa = {
  applinks: {
    apps: [],
    details: [
      {
        appID: APP_ID,
        appIDs: [APP_ID],
        paths: [
          'NOT /',
          'NOT /login',
          'NOT /register',
          'NOT /verify-email',
          'NOT /forgot-password',
          'NOT /dashboard',
          'NOT /reservations',
          'NOT /reservations/*',
          'NOT /service-logs',
          'NOT /clients',
          'NOT /clients/*',
          'NOT /services',
          'NOT /team',
          'NOT /reports',
          'NOT /plan',
          'NOT /settings',
          'NOT /super-admin',
          'NOT /super-admin/*',
          'NOT /explorar',
          'NOT /terms',
          'NOT /privacy',
          'NOT /api/*',
          'NOT /_next/*',
          'NOT /.well-known/*',
          '/*',
        ],
      },
    ],
  },
  webcredentials: {
    apps: [APP_ID],
  },
};

export function GET() {
  return new NextResponse(JSON.stringify(aasa), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300, s-maxage=600',
    },
  });
}
