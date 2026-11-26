const knex = require('knex');
const env = require('./env');

module.exports = knex({
  client: 'pg',
  connection: env.DATABASE_URL,
  searchPath: ['app', 'public'],
  pool: {
    min: 0,
    max: 10,
    acquireTimeoutMillis: 10000
  }
});
