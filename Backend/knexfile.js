const path = require('path');
const env = require('./config/env');

module.exports = {
  client: 'pg',
  connection: env.DATABASE_URL,
  searchPath: ['app', 'public'],
  pool: {
    min: 0,
    max: 10
  },
  migrations: {
    directory: path.resolve(__dirname, 'migrations'),
    extension: 'js'
  }
};
