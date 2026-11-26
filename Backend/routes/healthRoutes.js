const express = require('express');
const knex = require('../config/db');
const logger = require('../utils/logger');
const { serializeError } = require('../utils/errorLog');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await knex.raw('select 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    logger.error({ err: serializeError(error) }, 'Database health check failed');
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

module.exports = router;
