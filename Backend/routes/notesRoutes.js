const express = require('express');
const { z } = require('zod');
const env = require('../config/env');
const notesService = require('../services/notesService');
const { requireAuth } = require('../middlewares/auth');
const auditService = require('../services/auditService');

const router = express.Router();
const noteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().refine(
    (value) => Buffer.byteLength(value, 'utf8') <= env.MAX_NOTE_SIZE_BYTES,
    'La nota excede el tamaño permitido'
  )
}).strict();
const noteIdSchema = z.uuid();

function validateNoteId(req, res, next) {
  const result = noteIdSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Identificador de nota inválido' });
  }
  next();
}

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const notes = await notesService.list(req.session.userId);
    await auditService.logEvent({
      event_type: 'SENSITIVE_DATA_REVEALED',
      actor_id: req.session.userId,
      result: 'SUCCESS',
      details: { note_count: notes.length },
      request_id: req.id
    });
    res.json(notes);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const note = noteSchema.parse(req.body);
    res.status(201).json(await notesService.create(req.session.userId, note));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Datos de nota inválidos' });
    }
    next(error);
  }
});

router.get('/:id', validateNoteId, async (req, res, next) => {
  try {
    const note = await notesService.get(req.session.userId, req.params.id);
    if (!note) return res.status(404).json({ code: 'NOT_FOUND', message: 'Nota no encontrada' });
    await auditService.logEvent({
      event_type: 'SENSITIVE_DATA_REVEALED',
      actor_id: req.session.userId,
      target_id: note.id,
      result: 'SUCCESS',
      request_id: req.id
    });
    res.json(note);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', validateNoteId, async (req, res, next) => {
  try {
    const note = noteSchema.parse(req.body);
    const updated = await notesService.update(req.session.userId, req.params.id, note);
    if (!updated) return res.status(404).json({ code: 'NOT_FOUND', message: 'Nota no encontrada' });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Datos de nota inválidos' });
    }
    next(error);
  }
});

router.delete('/:id', validateNoteId, async (req, res, next) => {
  try {
    const removed = await notesService.remove(req.session.userId, req.params.id);
    if (!removed) return res.status(404).json({ code: 'NOT_FOUND', message: 'Nota no encontrada' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
