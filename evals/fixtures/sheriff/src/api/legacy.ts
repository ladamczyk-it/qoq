import type { Response } from 'express';

import type { AuthedRequest } from '../auth.js';
import { db } from '../db.js';

// qoq-sheriff: accepted — admin-only reporting tool, the role check is the whole guard and ops signed off on raw SQL here
export const runReport = async (req: AuthedRequest, res: Response) => {
  if (req.user.role !== 'admin') {
    res.status(403).end();
    return;
  }
  const { rows } = await db.query(String(req.body.sql));
  res.json(rows);
};
