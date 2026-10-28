import { Router } from 'express';
import { NotFound } from '../errors.js';
import { loadOrder } from './load.js';

export const ordersRouter = Router();

ordersRouter.get('/orders/:id', (req, res) => {
  try {
    const order = loadOrder(req.params.id);
    res.json({ ...order, total: '$' + ((order?.totalCents ?? 0) / 100).toFixed(2) });
  } catch (e) {
    if (e instanceof NotFound) return res.status(404).end();
    throw e;
  }
});
