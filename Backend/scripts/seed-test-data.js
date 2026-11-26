const { hashPassword } = require('../crypto/password');
const { encrypt } = require('../crypto/cipher');
const knex = require('../config/db');
const env = require('../config/env');

const fixtures = [
  {
    email: 'ana.garcia@securevault.test',
    name: 'Ana García',
    notes: [
      {
        id: 'a1010000-0000-4000-8000-000000000001',
        title: 'Plan para el viaje a Oaxaca',
        body: 'Reservar hospedaje cerca del centro. Llevar cámara, cargador y una chamarra ligera. Revisar horarios del museo el viernes.'
      },
      {
        id: 'a1010000-0000-4000-8000-000000000002',
        title: 'Ideas para la semana',
        body: 'Lunes: preparar presentación. Miércoles: clase de cerámica. Sábado: visitar a la familia y llevar el libro pendiente.'
      },
      {
        id: 'a1010000-0000-4000-8000-000000000003',
        title: 'Receta de sopa de lentejas',
        body: 'Sofreír cebolla, zanahoria y ajo. Añadir lentejas, tomate, comino y caldo. Cocinar a fuego bajo hasta que estén suaves.'
      }
    ]
  },
  {
    email: 'marco.rivera@securevault.test',
    name: 'Marco Rivera',
    notes: [
      {
        id: 'a1010000-0000-4000-8000-000000000004',
        title: 'Proyecto: renovación del sitio',
        body: 'Pendientes: revisar accesibilidad con teclado, optimizar imágenes, validar formularios y preparar una prueba con usuarios el próximo martes.'
      },
      {
        id: 'a1010000-0000-4000-8000-000000000005',
        title: 'Libros por leer',
        body: 'Ciencia ficción: empezar la novela recomendada por Elena. Diseño: terminar los capítulos sobre sistemas de color y tipografía.'
      },
      {
        id: 'a1010000-0000-4000-8000-000000000006',
        title: 'Lista para el mercado',
        body: 'Café, avena, tomates, espinacas, arroz, limones y jabón para platos.'
      }
    ]
  },
  {
    email: 'lucia.vega@securevault.test',
    name: 'Lucía Vega',
    notes: [
      {
        id: 'a1010000-0000-4000-8000-000000000007',
        title: 'Agenda del equipo',
        body: 'Reunión de seguimiento el jueves a las 10:00. Compartir el resumen del sprint y confirmar responsables de las tareas abiertas.'
      },
      {
        id: 'a1010000-0000-4000-8000-000000000008',
        title: 'Notas de jardinería',
        body: 'La albahaca necesita más luz indirecta. Regar el romero solo cuando la tierra esté seca y cambiar la maceta del pothos.'
      },
      {
        id: 'a1010000-0000-4000-8000-000000000009',
        title: 'Objetivos del mes',
        body: 'Retomar caminatas tres veces por semana, ordenar los archivos del curso y reservar una tarde para descansar sin pantallas.'
      }
    ]
  }
];

async function getOrCreateUser(trx, fixture, password) {
  const existing = await trx('app.users')
    .where({ email: fixture.email })
    .first('id', 'name', 'role');

  if (existing) {
    if (existing.name !== fixture.name || existing.role !== 'user') {
      throw new Error(`El usuario de prueba ${fixture.email} ya existe con datos distintos; no se modificó.`);
    }
    const passwordHash = await hashPassword(password);
    await trx('app.users').where({ id: existing.id }).update({
      password_hash: passwordHash,
      failed_attempts: 0,
      locked_until: null
    });
    return existing.id;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await trx('app.users')
    .insert({
      email: fixture.email,
      name: fixture.name,
      password_hash: passwordHash,
      role: 'user'
    })
    .returning('id');

  return user.id;
}

async function upsertNote(trx, userId, note) {
  const existing = await trx('app.notes')
    .where({ id: note.id })
    .first('user_id');

  if (existing && existing.user_id !== userId) {
    throw new Error(`Conflicto de identificador al preparar la nota de prueba ${note.id}.`);
  }

  const values = {
    user_id: userId,
    title_ciphertext: encrypt(note.title, `${userId}:${note.id}:title`),
    body_ciphertext: encrypt(note.body, `${userId}:${note.id}:body`),
    updated_at: trx.fn.now()
  };

  if (existing) {
    await trx('app.notes').where({ id: note.id }).update(values);
    return;
  }

  await trx('app.notes').insert({ id: note.id, ...values });
}

async function seedTestData() {
  if (env.NODE_ENV === 'production') {
    throw new Error('El seeder de prueba está deshabilitado en NODE_ENV=production.');
  }
  if (process.env.ALLOW_TEST_DATA_SEED !== 'YES') {
    throw new Error('Confirma el uso de datos sintéticos configurando ALLOW_TEST_DATA_SEED=YES.');
  }

  const password = process.env.TEST_DATA_PASSWORD;
  if (typeof password !== 'string' || password.length < 12 || password.length > 64) {
    throw new Error('TEST_DATA_PASSWORD debe tener entre 12 y 64 caracteres.');
  }

  const counts = await knex.transaction(async (trx) => {
    let noteCount = 0;

    for (const fixture of fixtures) {
      const userId = await getOrCreateUser(trx, fixture, password);
      for (const note of fixture.notes) {
        await upsertNote(trx, userId, note);
        noteCount += 1;
      }
    }

    return { users: fixtures.length, notes: noteCount };
  });

  console.log(`Datos sintéticos listos: ${counts.users} usuarios y ${counts.notes} notas cifradas.`);
  console.log(`Cuentas de prueba: ${fixtures.map(({ email }) => email).join(', ')}`);
}

async function main() {
  try {
    await seedTestData();
  } catch (error) {
    console.error(`No se pudieron crear los datos de prueba: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await knex.destroy();
  }
}

main();
