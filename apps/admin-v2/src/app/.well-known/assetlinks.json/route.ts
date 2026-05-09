import { NextResponse } from 'next/server';

// Android App Links manifest. Served at /.well-known/assetlinks.json with
// content-type application/json. Adds the customer Flutter app as a verified
// handler for /<slug> routes on dev.goturnly.com / goturnly.com.
//
// To add the release-signed key once available, append another fingerprint
// to the sha256_cert_fingerprints array.

// Two Android packages share App Links on the same domains:
// - com.turnly.customer        → prod build (release-signed)
// - com.turnly.customer.dev    → dev flavor build (debug-signed during local
//                                testing; add the dev release fingerprint
//                                here once you sign a separate dev APK).
//
// Both packages must be listed so each one auto-verifies independently.
const FINGERPRINTS_DEBUG = [
  '58:40:E0:0C:33:65:10:17:BD:06:64:D2:FC:A6:1B:C6:3F:BC:90:2A:54:BC:6A:C5:DA:42:28:E2:D4:87:7D:F7',
];

// TODO: append the production release-keystore SHA256 fingerprint here
// once the customer app is signed for Play Store distribution.
const FINGERPRINTS_RELEASE: string[] = [];

const assetlinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.turnly.customer',
      sha256_cert_fingerprints: [
        ...FINGERPRINTS_DEBUG,
        ...FINGERPRINTS_RELEASE,
      ],
    },
  },
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.turnly.customer.dev',
      sha256_cert_fingerprints: FINGERPRINTS_DEBUG,
    },
  },
];

export function GET() {
  return new NextResponse(JSON.stringify(assetlinks), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300, s-maxage=600',
    },
  });
}
