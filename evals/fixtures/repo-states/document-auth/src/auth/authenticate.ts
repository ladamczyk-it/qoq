import { TokenError, type ITokenPayload, type TokenService } from './TokenService.js';

const LEGACY_PREFIX = 'Token ';

export const authenticate = (
  service: TokenService,
  header: string | undefined
): ITokenPayload | null => {
  if (!header) {
    return null;
  }

  const raw = header.startsWith(LEGACY_PREFIX)
    ? header.slice(LEGACY_PREFIX.length)
    : header.replace(/^Bearer /, '');

  try {
    return service.verify(raw);
  } catch (error) {
    if (error instanceof TokenError && error.code === 'EXPIRED') {
      return null;
    }

    throw error;
  }
};
