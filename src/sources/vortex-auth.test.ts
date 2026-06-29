import { describe, expect, test } from 'bun:test';
import { buildVortexAuth } from './vortex-auth';

describe('buildVortexAuth', () => {
  test('adds the secret key header and public key body field when both keys are configured', () => {
    const auth = buildVortexAuth({
      publicKey: 'pk_test_public',
      secretKey: 'sk_test_secret',
    });

    expect(auth.headers).toEqual({
      'X-API-Key': 'sk_test_secret',
    });
    expect(auth.bodyFields).toEqual({
      apiKey: 'pk_test_public',
    });
  });
});
