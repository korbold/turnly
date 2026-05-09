import { NextResponse } from 'next/server';

// Android App Links manifest. Served at /.well-known/assetlinks.json with
// content-type application/json. Adds the customer Flutter app as a verified
// handler for /<slug> routes on dev.goturnly.com / goturnly.com.
//
// To add the release-signed key once available, append another fingerprint
// to the sha256_cert_fingerprints array.

const PACKAGE_NAME = 'com.turnly.customer';

const FINGERPRINTS = [
  // Android debug keystore (~/.android/debug.keystore)
  '58:40:E0:0C:33:65:10:17:BD:06:64:D2:FC:A6:1B:C6:3F:BC:90:2A:54:BC:6A:C5:DA:42:28:E2:D4:87:7D:F7',
  // TODO: add release SHA256 once the production keystore is generated
];

const assetlinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: PACKAGE_NAME,
      sha256_cert_fingerprints: FINGERPRINTS,
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
