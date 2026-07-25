import { createHmac, hkdfSync } from 'node:crypto';

export function deriveKey(base64UrlSecret: string, context: string): Uint8Array {
  return new Uint8Array(
    hkdfSync(
      'sha256',
      Buffer.from(base64UrlSecret, 'base64url'),
      Buffer.alloc(0),
      `edu-mentor/${context}/v1`,
      32,
    ),
  );
}

export function hmacBase64Url(key: Uint8Array, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('base64url');
}
