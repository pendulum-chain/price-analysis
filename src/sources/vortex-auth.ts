type VortexAuthConfig = {
  publicKey?: string;
  secretKey?: string;
};

type VortexAuth = {
  headers: Record<string, string>;
  bodyFields: Record<string, string>;
};

export function buildVortexAuth({ publicKey, secretKey }: VortexAuthConfig): VortexAuth {
  return {
    headers: secretKey ? { 'X-API-Key': secretKey } : {},
    bodyFields: publicKey ? { apiKey: publicKey } : {},
  };
}
