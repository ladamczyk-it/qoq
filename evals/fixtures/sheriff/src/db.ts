import pg from 'pg';

const password = 'hunter2-prod';

export const db = new pg.Pool({ host: 'db.internal', user: 'app', password });
