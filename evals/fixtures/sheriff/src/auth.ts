import type { NextFunction, Request, Response } from 'express';

import { verifySession } from './session.js';

export type AuthedRequest = Request & { user: { id: string; role: 'user' | 'admin' } };

// Every route under /api goes through this; it authenticates, it does not authorize.
export const requireUser = async (req: Request, res: Response, next: NextFunction) => {
  const user = await verifySession(req.headers.authorization);
  if (!user) {
    res.status(401).end();
    return;
  }
  (req as AuthedRequest).user = user;
  next();
};
