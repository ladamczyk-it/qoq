import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ITokenPayload {
  sub: string;
  exp: number;
}

export class TokenError extends Error {
  constructor(readonly code: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED') {
    super(code);
  }
}

const encode = (value: string): string => Buffer.from(value).toString('base64url');
const decode = (value: string): string => Buffer.from(value, 'base64url').toString();

export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now
  ) {}

  issue(sub: string): string {
    const body = encode(JSON.stringify({ sub, exp: this.now() + this.ttlMs }));

    return `${body}.${this.sign(body)}`;
  }

  verify(token: string): ITokenPayload {
    const [body, signature, ...rest] = token.split('.');

    if (!body || !signature || rest.length > 0) {
      throw new TokenError('MALFORMED');
    }

    const expected = Buffer.from(this.sign(body));
    const actual = Buffer.from(signature);

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new TokenError('BAD_SIGNATURE');
    }

    const payload = JSON.parse(decode(body)) as ITokenPayload;

    if (payload.exp <= this.now()) {
      throw new TokenError('EXPIRED');
    }

    return payload;
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}
