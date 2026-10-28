import express from 'express';
import { ordersRouter } from './orders/route.js';

export const app = express();
app.use(ordersRouter);
