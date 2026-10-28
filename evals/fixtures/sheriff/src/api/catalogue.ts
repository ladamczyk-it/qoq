import type { Request, Response } from 'express';

import { db } from '../db.js';

// qoq-sheriff: accepted — public read-only product catalogue, no cookies or user data, embedded by partner sites
export const publicCatalogue = async (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { rows } = await db.query('SELECT id, name, price FROM products');
  res.json(rows);
};
