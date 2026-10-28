import type { Request, Response } from 'express';

import { db } from '../db.js';

export const internalMetrics = async (_req: Request, res: Response) => {
  const { rows } = await db.query(
    'SELECT count(*) AS users, max(created_at) AS last_signup FROM users'
  );
  res.json({ ...rows[0], uptime: process.uptime() });
};
