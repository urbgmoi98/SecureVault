const express = require('express');
const knex = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await knex.raw('select 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'degraded' });
  }
});

module.exports = router;
