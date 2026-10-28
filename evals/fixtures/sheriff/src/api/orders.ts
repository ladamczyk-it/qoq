import type { Response } from 'express';

import type { AuthedRequest } from '../auth.js';
import { db } from '../db.js';

export const listOrders = async (req: AuthedRequest, res: Response) => {
  const { rows } = await db.query('SELECT * FROM orders WHERE owner_id = $1', [req.user.id]);
  res.json(rows);
};

export const getOrder = async (req: AuthedRequest, res: Response) => {
  const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!rows[0]) {
    res.status(404).end();
    return;
  }
  res.json(rows[0]);
};
