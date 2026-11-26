const { z } = require('zod');
const { hashPassword } = require('../crypto/password');
const logger = require('../utils/logger');

const adminConfigSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(2).max(100),
  password: z.string().min(12).max(64)
});

exports.seed = async function (knex) {
  const config = adminConfigSchema.safeParse({
    email: typeof process.env.ADMIN_EMAIL === 'string' ? process.env.ADMIN_EMAIL.trim().toLowerCase() : '',
    name: typeof process.env.ADMIN_NAME === 'string' ? process.env.ADMIN_NAME.trim() : '',
    password: process.env.ADMIN_PASSWORD
  });

  if (!config.success) {
    throw new Error('ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD must contain valid admin credentials');
  }

  const { email, name, password } = config.data;
  const existingAdmin = await knex('app.users').where({ email }).first('id');

  if (existingAdmin) {
    logger.info('El usuario administrador ya existe; no se realizaron cambios');
    return;
  }

  const passwordHash = await hashPassword(password);

  try {
    await knex('app.users').insert({
      email,
      name,
      password_hash: passwordHash,
      role: 'admin'
    });
  } catch (error) {
    if (!error || error.code !== '23505') throw error;

    logger.info('El usuario administrador ya existe; no se realizaron cambios');
    return;
  }

  logger.info('Usuario administrador inicial creado');
};
