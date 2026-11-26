const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authService = require('../services/authService');
const { z } = require('zod');
const { generateToken, hashToken } = require('../crypto/token');

// Rate Limit específico para Auth (RF-02)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Esquemas Zod Estrictos
const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(12).max(64) // Regla 3.1
}).strict(); // Rechaza roles extra

router.get('/csrf', (req, res) => {
  const csrfToken = generateToken();
  req.session.csrfToken = hashToken(csrfToken, 'HMAC_KEY_CSRF');
  res.json({ csrfToken });
});

router.get('/me', async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'No autenticado' });
  }

  try {
    const user = await authService.getCurrentUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'No autenticado' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    await authService.register(data);
    res.status(201).json({ message: 'Registro procesado' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Datos inválidos' });
    next(error);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).strict().parse(req.body);
    const user = await authService.login(email, password, req.id);

    // Regenerar ID de sesión al autenticar (RF-02)
    req.session.regenerate((err) => {
      if (err) return next(err);
      
      // Guardar datos en sesión
      req.session.userId = user.id;
      req.session.role = user.role;
      
      // Generar token CSRF para la nueva sesión
      const csrfToken = generateToken();
      req.session.csrfToken = hashToken(csrfToken, 'HMAC_KEY_CSRF');
      
      req.session.save((err) => {
        if (err) return next(err);
        // Enviar token CSRF al cliente (en respuesta JSON)
        res.json({ 
          id: user.id, 
          name: user.name, 
          role: user.role,
          csrfToken: csrfToken 
        });
      });
    });
  } catch (error) {
    if (error.message === 'ACCOUNT_LOCKED') {
      return res.status(429).json({ code: 'TOO_MANY_REQUESTS', message: 'Cuenta bloqueada temporalmente' });
    }
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Credenciales inválidas' });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Datos inválidos' });
    }
    next(error);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ code: 'INTERNAL_ERROR' });
    res.clearCookie('__Host-SecureVault', { path: '/' });
    res.clearCookie('SecureVault', { path: '/' });
    res.status(204).send();
  });
});

router.post('/password/forgot', authLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    await authService.forgotPassword(email);
    res.json({ message: 'Si el correo existe, se ha enviado un enlace' });
  } catch (error) {
    next(error);
  }
});

router.post('/password/reset', authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = z.object({ 
      token: z.string(), 
      newPassword: z.string().min(12).max(64) 
    }).parse(req.body);
    await authService.resetPassword(token, newPassword);
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    if (error.message === 'INVALID_TOKEN') {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Token inválido o expirado' });
    }
    next(error);
  }
});

module.exports = router;