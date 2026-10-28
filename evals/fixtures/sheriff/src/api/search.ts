import type { Response } from 'express';

import type { AuthedRequest } from '../auth.js';
import { db } from '../db.js';

export const searchProducts = async (req: AuthedRequest, res: Response) => {
  const term = String(req.query.q ?? '');
  const { rows } = await db.query("SELECT id, name FROM products WHERE name LIKE '%" + term + "%'");
  res.json(rows);
};
