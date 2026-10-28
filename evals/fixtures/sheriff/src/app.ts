import express from 'express';

import { requireUser } from './auth.js';
import { publicCatalogue } from './api/catalogue.js';
import { runReport } from './api/legacy.js';
import { internalMetrics } from './api/metrics.js';
import { getOrder, listOrders } from './api/orders.js';
import { searchProducts } from './api/search.js';

export const app = express();
app.use(express.json());

app.get('/internal/metrics', internalMetrics);
app.get('/catalogue', publicCatalogue);

app.use('/api', requireUser);
app.get('/api/orders', listOrders);
app.get('/api/orders/:id', getOrder);
app.get('/api/search', searchProducts);
app.post('/api/reports', runReport);
