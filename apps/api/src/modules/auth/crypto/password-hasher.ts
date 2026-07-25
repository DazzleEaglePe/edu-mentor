import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024;
const KEY_LENGTH = 64;
const VERSION = 1;
const DUMMY_SALT = Buffer.alloc(16, 0xa5);
const DUMMY_DIGEST = Buffer.alloc(KEY_LENGTH, 0x5a);

interface ParsedPasswordHash {
  readonly digest: Buffer;
  readonly salt: Buffer;
}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: SCRYPT_N,
        maxmem: SCRYPT_MAX_MEMORY,
        p: SCRYPT_P,
        r: SCRYPT_R,
      },
      (error, derivedKey) => {
        if (error === null) {
          resolve(derivedKey);
          return;
        }
        reject(error);
      },
    );
  });
}

function parsePasswordHash(encoded: string): ParsedPasswordHash | null {
  const [algorithm, version, parameters, salt, digest] = encoded.split('$');

  if (
    algorithm !== 'scrypt' ||
    version !== `v=${VERSION}` ||
    parameters !== `N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}` ||
    salt === undefined ||
    digest === undefined
  ) {
    return null;
  }

  try {
    const parsedSalt = Buffer.from(salt, 'base64url');
    const parsedDigest = Buffer.from(digest, 'base64url');

    if (parsedSalt.byteLength !== 16 || parsedDigest.byteLength !== KEY_LENGTH) {
      return null;
    }

    return {
      digest: parsedDigest,
      salt: parsedSalt,
    };
  } catch {
    return null;
  }
}

@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const digest = await derivePasswordKey(password, salt);

    return [
      'scrypt',
      `v=${VERSION}`,
      `N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}`,
      salt.toString('base64url'),
      digest.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    const parsed = parsePasswordHash(encoded);

    if (parsed === null) {
      return false;
    }

    const digest = await derivePasswordKey(password, parsed.salt);
    return timingSafeEqual(digest, parsed.digest);
  }

  async consumeEquivalentWork(password: string): Promise<void> {
    const digest = await derivePasswordKey(password, DUMMY_SALT);
    timingSafeEqual(digest, DUMMY_DIGEST);
  }
}
