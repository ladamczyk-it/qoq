import { createServer } from 'node:http';

import { tripsRouter } from './trips/router.js';
import { createStore } from './trips/store.js';

createServer(tripsRouter(createStore())).listen(Number(process.env.PORT ?? 3000));
