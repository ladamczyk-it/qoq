import { writeFileSync } from 'fs';

import config from './config.js';

writeFileSync('./index.json', JSON.stringify(config, undefined, 2));
