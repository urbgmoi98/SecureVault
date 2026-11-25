const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { z } = require('zod');

// Denegar por defecto si no es admin (RF-03)
router.use(requireAuth, requireRole('admin'));

router.get('/users', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const users = await adminService.getUsers(20, (page - 1) * 20);
    res.json(users);
  } catch (err) { next(err); }
});

router.get('/events', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const events = await adminService.getEvents(req.query, 20, (page - 1) * 20);
    res.json(events);
  } catch (err) { next(err); }
});

router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = z.object({ role: z.enum(['user', 'admin']) }).strict().parse(req.body);
    await adminService.updateUserRole(req.session.userId, req.params.id, role);
    res.json({ message: 'Rol actualizado' });
  } catch (err) { next(err); }
});

module.exports = router;