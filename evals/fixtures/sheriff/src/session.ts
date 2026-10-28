export const verifySession = async (header: string | undefined) => {
  if (!header?.startsWith('Bearer ')) return null;
  // Signature check lives in the gateway; this only decodes the forwarded claim.
  const claim = JSON.parse(Buffer.from(header.slice(7), 'base64url').toString());
  return claim as { id: string; role: 'user' | 'admin' };
};
